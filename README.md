# polar-alerts

Telegram alerts for [Polar](https://polar.sh) webhook events: new subscriptions, payments, cancellations, refunds, failed payments and more, with links straight to your Polar dashboard.

## Install

```bash
npm install polar-alerts @polar-sh/sdk zod
```

## Usage

Create a client once, then pass every verified webhook event to `handleWebhook`:

```ts
import { validateEvent, WebhookVerificationError } from '@polar-sh/sdk/webhooks'
import { PolarAlertsClient } from 'polar-alerts'

const alerts = new PolarAlertsClient({
    polarServer: 'production',
    polarOrganizationSlug: 'my-org',
    telegram: {
        botToken: process.env.TELEGRAM_BOT_TOKEN!,
        chatId: process.env.TELEGRAM_CHAT_ID!,
    },
})

export async function POST(request: Request) {
    const body = await request.text()

    let event
    try {
        event = validateEvent(
            body,
            Object.fromEntries(request.headers),
            process.env.POLAR_WEBHOOK_SECRET!,
        )
    } catch (error) {
        if (error instanceof WebhookVerificationError) {
            return new Response('', { status: 403 })
        }
        throw error
    }

    await alerts.handleWebhook(event)

    // ...your own webhook handling

    return new Response('', { status: 202 })
}
```

With `@polar-sh/nextjs`, call it from `onPayload`:

```ts
export const POST = Webhooks({
    webhookSecret: process.env.POLAR_WEBHOOK_SECRET!,
    onPayload: (payload) => alerts.handleWebhook(payload),
})
```

`handleWebhook` never throws, so a failed alert can't break your webhook handler. Errors are logged, and if an alert can't be built, a short "⚠️ Failed to build alert" message is sent instead.

### Serverless

By default `handleWebhook` resolves once the alert has been delivered. To respond to Polar first and send the alert in the background, pass your platform's `waitUntil`:

```ts
import { waitUntil } from '@vercel/functions'

const alerts = new PolarAlertsClient({
    // ...
    waitUntil,
})
```

## Configuration

| Option                  | Description                                                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `polarServer`           | `'production'` or `'sandbox'`. Used for dashboard links.                                                           |
| `polarOrganizationSlug` | Your organization slug. Used for dashboard links.                                                                  |
| `telegram.botToken`     | Bot token from [@BotFather](https://t.me/BotFather).                                                               |
| `telegram.chatId`       | User, group or channel ID to send alerts to.                                                                       |
| `telegram.threadId`     | Optional topic ID in a forum group.                                                                                |
| `telegram.silent`       | `true` sends every alert without sound, `false` makes every alert notify. When unset, each alert uses its default. |
| `events`                | Turn individual events on or off (merged with the defaults below), or `'all'`.                                     |
| `timeZone`              | IANA time zone for dates, e.g. `'Europe/Berlin'`. Defaults to `'UTC'`.                                             |
| `currency`              | Fallback currency when a payload has none. Defaults to `'usd'`.                                                    |
| `waitUntil`             | Defers delivery in serverless environments (see above).                                                            |

### Events

| Event                                                        | Default | Notes                                   |
| ------------------------------------------------------------ | ------- | --------------------------------------- |
| `order.paid`                                                 | on      | Plays a notification sound              |
| `order.refunded`                                             | on      |                                         |
| `subscription.created`                                       | on      |                                         |
| `subscription.active`                                        | on      |                                         |
| `subscription.updated`                                       | on      | Only when a renewal payment is past due |
| `subscription.canceled`                                      | on      | When the customer cancels               |
| `subscription.uncanceled`                                    | on      |                                         |
| `subscription.revoked`                                       | on      | Access has ended                        |
| `refund.created` / `refund.updated`                          | on      |                                         |
| `customer_seat.assigned` / `claimed` / `revoked`             | on      | Claimed plays a notification sound      |
| `order.created` / `order.updated`                            | off     |                                         |
| `checkout.created` / `checkout.updated`                      | off     |                                         |
| `customer.created` / `customer.updated` / `customer.deleted` | off     |                                         |

```ts
new PolarAlertsClient({
    // ...
    events: {
        'checkout.created': true,
        'refund.created': false,
    },
})
```

### Customer details

Alerts show a customer's device and referrer when their metadata includes them. Capture them in the browser (e.g. `document.referrer` on your landing page) and set them when creating the checkout:

```ts
await polar.checkouts.create({
    products: [productId],
    customerMetadata: {
        deviceType, // 'mobile' | 'tablet' | 'desktop'
        referrer, // a full URL; shown as a link to its hostname
    },
})
```

## Custom alerts

Send your own alerts through the same channels. The description is [Telegram HTML](https://core.telegram.org/bots/api#html-style), so escape any dynamic values:

```ts
import { escapeHtml } from 'polar-alerts'

await alerts.sendAlert({
    title: '🚀 Deploy finished',
    description: `<b>Version</b> - <code>${escapeHtml(version)}</code>`,
})
```

## License

MIT
