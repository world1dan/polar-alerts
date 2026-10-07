import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    mock,
    spyOn,
} from 'bun:test'

import { htmlToText } from '../src/html'
import type { PolarAlertsConfig, WebhookPayload } from '../src/types'
import { formatDate, formatMoney, formatRecurringInterval } from '../src/utils'
import {
    checkout,
    customer,
    member,
    NOW,
    order,
    payload,
    payloads,
    product,
    refund,
    seat,
    subscription,
} from './fixtures'
import { validateTelegramHtml } from './telegram-html'

type SendMessage = (
    chatId: string,
    text: string,
    options: Record<string, unknown>,
) => Promise<unknown>

const sendMessage = mock<SendMessage>(() => Promise.resolve({}))

mock.module('node-telegram-bot-api', () => ({
    default: class {
        sendMessage = sendMessage
    },
}))

// Imported after the Telegram client is mocked, so the client picks up the mock
const { PolarAlertsClient } = await import('../src/webhook-handler')

const baseConfig: PolarAlertsConfig = {
    polarServer: 'production',
    polarOrganizationSlug: 'acme',
    telegram: { botToken: 'token', chatId: '-100123' },
}

interface SentMessage {
    text: string
    options: Record<string, unknown>
}

function sentMessages(): SentMessage[] {
    return sendMessage.mock.calls.map(([, text, options]) => ({
        text,
        options,
    }))
}

/** Runs a webhook through a client with every alert enabled, unless overridden. */
async function send(
    event: WebhookPayload,
    config: Partial<PolarAlertsConfig> = {},
): Promise<SentMessage[]> {
    sendMessage.mockClear()
    const client = new PolarAlertsClient({
        ...baseConfig,
        events: 'all',
        ...config,
    })
    await client.handleWebhook(event)
    return sentMessages()
}

async function sendOne(
    event: WebhookPayload,
    config?: Partial<PolarAlertsConfig>,
): Promise<SentMessage> {
    const messages = await send(event, config)
    expect(messages).toHaveLength(1)
    return messages[0]
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const orderPaid = payload('order.paid', order)

let consoleSpies: { mockRestore(): void }[] = []

beforeEach(() => {
    sendMessage.mockReset()
    sendMessage.mockResolvedValue({})
    consoleSpies = [
        spyOn(console, 'error').mockImplementation(() => {}),
        spyOn(console, 'warn').mockImplementation(() => {}),
    ]
})

afterEach(() => {
    // Restore just these spies, leaving the Telegram module mock in place
    for (const spy of consoleSpies) {
        spy.mockRestore()
    }
})

describe('alert templates', () => {
    it.each(payloads.map((event) => [event.type, event] as const))(
        '%s',
        async (_type, event) => {
            const message = await sendOne(event)

            expect(message.options.parse_mode).toBe('HTML')
            expect(validateTelegramHtml(message.text)).toEqual([])
            expect(htmlToText(message.text).length).toBeLessThanOrEqual(4096)
            expect(message.text).toMatchSnapshot()
        },
    )
})

describe('delivery', () => {
    it('resolves only after the alert has been delivered', async () => {
        let delivered = false
        sendMessage.mockImplementation(async () => {
            await sleep(10)
            delivered = true
        })

        await new PolarAlertsClient(baseConfig).handleWebhook(orderPaid)

        expect(delivered).toBe(true)
    })

    it('does not throw when Telegram rejects the message', async () => {
        sendMessage.mockRejectedValue(
            new Error('ETELEGRAM: 403 Forbidden: bot was blocked by the user'),
        )

        await expect(
            new PolarAlertsClient(baseConfig).handleWebhook(orderPaid),
        ).resolves.toBeUndefined()
        expect(console.error).toHaveBeenCalled()
    })

    it('returns immediately and hands delivery to waitUntil', async () => {
        let finishSending!: () => void
        sendMessage.mockReturnValue(
            new Promise<void>((resolve) => {
                finishSending = resolve
            }),
        )
        const pending: Promise<unknown>[] = []
        const client = new PolarAlertsClient({
            ...baseConfig,
            waitUntil: (promise) => {
                pending.push(promise)
            },
        })

        const result = await Promise.race([
            client.handleWebhook(orderPaid).then(() => 'returned'),
            sleep(100).then(() => 'blocked'),
        ])

        expect(result).toBe('returned')
        expect(pending).toHaveLength(1)

        finishSending()
        await pending[0]
        expect(sendMessage).toHaveBeenCalledTimes(1)
    })

    it('passes waitUntil a promise that never rejects', async () => {
        sendMessage.mockRejectedValue(new Error('network down'))
        const pending: Promise<unknown>[] = []

        await new PolarAlertsClient({
            ...baseConfig,
            waitUntil: (promise) => {
                pending.push(promise)
            },
        }).handleWebhook(orderPaid)

        await expect(pending[0]).resolves.toBeUndefined()
    })

    it('delivers inline when waitUntil throws', async () => {
        await new PolarAlertsClient({
            ...baseConfig,
            waitUntil: () => {
                throw new Error('called outside a request context')
            },
        }).handleWebhook(orderPaid)

        expect(sendMessage).toHaveBeenCalledTimes(1)
    })
})

describe('building alerts', () => {
    it('uses the order description when the order has no product', async () => {
        const message = await sendOne(
            payload('order.paid', {
                ...order,
                product: null,
                description: 'Legacy bundle',
            }),
        )

        expect(message.text).toContain('Legacy bundle')
    })

    it('sends a fallback alert instead of throwing when a template fails', async () => {
        const broken = payload('subscription.created', {
            ...subscription,
            product: undefined as never,
        })

        const message = await sendOne(broken)

        expect(message.text).toContain(
            '⚠️ Failed to build subscription.created alert',
        )
        expect(message.text).toContain('<code>sub_1</code>')
        expect(validateTelegramHtml(message.text)).toEqual([])
        expect(console.error).toHaveBeenCalled()
    })
})

describe('escaping', () => {
    it('keeps the markup valid for hostile or unusual values', async () => {
        const message = await sendOne(
            payload('subscription.canceled', {
                ...subscription,
                status: 'active',
                cancelAtPeriodEnd: true,
                product: { ...product, name: 'Pro [Beta] <b>*_`' },
                discount: {
                    ...subscription.discount!,
                    name: 'Half *off* & more',
                    code: 'LAUNCH_50',
                },
                customer: {
                    ...customer,
                    name: '</code><script>alert(1)</script>',
                    email: 'a_b`c@example.com',
                    metadata: { referrer: 'javascript:alert(1)' },
                },
                customerCancellationComment: 'pls `asap` </pre> & thanks',
                metadata: { note: '```<i>' },
            }),
        )
        const text = htmlToText(message.text)

        expect(validateTelegramHtml(message.text)).toEqual([])
        expect(text).toContain('Pro [Beta] <b>*_`')
        expect(text).toContain('Half *off* & more')
        expect(text).toContain('</code><script>alert(1)</script>')
        expect(text).toContain('pls `asap` </pre> & thanks')
        expect(message.text).toContain('<code>LAUNCH_50</code>')
        // Not a web URL, so it's shown as text instead of a link
        expect(message.text).not.toContain('href="javascript:')
        expect(text).toContain('javascript:alert(1)')
    })

    it('escapes quotes and brackets inside link URLs', async () => {
        const message = await sendOne(
            payload('subscription.created', {
                ...subscription,
                customer: {
                    ...customer,
                    metadata: { referrer: 'https://example.com/a)b"c' },
                },
            }),
        )

        expect(validateTelegramHtml(message.text)).toEqual([])
        expect(message.text).toContain(
            '<a href="https://example.com/a)b&quot;c">example.com</a>',
        )
    })
})

describe('message length', () => {
    const bigObject = Object.fromEntries(
        Array.from({ length: 200 }, (_, i) => [`key_${i}`, 'x'.repeat(50)]),
    )

    it("truncates large metadata to stay within Telegram's limit", async () => {
        const message = await sendOne(
            payload('order.created', {
                ...order,
                metadata: bigObject,
                customFieldData: bigObject,
            }),
        )

        expect(message.options.parse_mode).toBe('HTML')
        expect(htmlToText(message.text).length).toBeLessThanOrEqual(4096)
        expect(message.text).toContain('…</pre>')
        expect(validateTelegramHtml(message.text)).toEqual([])
    })

    it('falls back to truncated plain text when the message is too long', async () => {
        await new PolarAlertsClient(baseConfig).sendAlert({
            title: 'Big',
            description: `<b>bold</b> ${'y'.repeat(5000)}`,
        })

        const [message] = sentMessages()
        expect(message.options.parse_mode).toBeUndefined()
        expect(message.text).toHaveLength(4096)
        expect(message.text.startsWith('Big\n\nbold yyy')).toBe(true)
        expect(message.text.endsWith('…')).toBe(true)
    })

    it('resends as plain text when Telegram cannot parse the markup', async () => {
        sendMessage.mockRejectedValueOnce(
            new Error(
                'ETELEGRAM: 400 Bad Request: can\'t parse entities: Unsupported start tag "foo"',
            ),
        )

        await new PolarAlertsClient(baseConfig).sendAlert({
            title: 'Custom',
            description: '<foo>bar</foo> &amp; baz',
        })

        const messages = sentMessages()
        expect(messages).toHaveLength(2)
        expect(messages[1].options.parse_mode).toBeUndefined()
        expect(messages[1].text).toBe('Custom\n\nbar & baz')
    })
})

describe('telegram options', () => {
    it('omits message_thread_id unless a thread is configured', async () => {
        const message = await sendOne(orderPaid)

        expect(message.options).not.toHaveProperty('message_thread_id')
    })

    it('sends to the configured thread', async () => {
        const message = await sendOne(orderPaid, {
            telegram: { ...baseConfig.telegram!, threadId: '42' },
        })

        expect(message.options.message_thread_id).toBe(42)
    })

    it('disables link previews', async () => {
        const message = await sendOne(orderPaid)

        expect(message.options.link_preview_options).toEqual({
            is_disabled: true,
        })
    })

    it.each([
        [undefined, 'order.paid', false],
        [undefined, 'subscription.created', true],
        [true, 'order.paid', true],
        [false, 'subscription.created', false],
    ] as const)(
        'silent: %s makes %s alerts disable_notification=%s',
        async (silent, event, expected) => {
            const message = await sendOne(
                payloads.find((p) => p.type === event)!,
                { telegram: { ...baseConfig.telegram!, silent } },
            )

            expect(message.options.disable_notification).toBe(expected)
        },
    )
})

describe('formatting', () => {
    it.each([
        [1050, 'usd', '$10.50'],
        [1000, 'usd', '$10'],
        [-500, 'usd', '-$5'],
        [123456, 'eur', '€1,234.56'],
        [5000, 'jpy', '¥5,000'],
        [1050, 'not-a-currency', 'NOT-A-CURRENCY 10.50'],
    ])('formatMoney(%i, %s) = %s', (amount, currency, expected) => {
        expect(formatMoney(amount, currency)).toBe(expected)
    })

    it.each([
        ['month', 1, '/month'],
        ['year', null, '/year'],
        ['month', 3, ' every 3 months'],
    ] as const)(
        'formatRecurringInterval(%s, %s) = "%s"',
        (interval, count, expected) => {
            expect(formatRecurringInterval(interval, count)).toBe(expected)
        },
    )

    it('formats dates in the configured time zone', () => {
        expect(formatDate(NOW, 'UTC')).toBe('Oct 1, 2026, 12:00 PM UTC')
        expect(formatDate(NOW, 'America/New_York')).toBe(
            'Oct 1, 2026, 8:00 AM EDT',
        )
        expect(formatDate(NOW, 'UTC', 'date')).toBe('Oct 1, 2026')
    })

    it('uses the timeZone option in alerts, defaulting to UTC', async () => {
        const orderUpdated = payload('order.updated', order)

        expect((await sendOne(orderUpdated)).text).toContain(
            '<code>Oct 1, 2026, 12:00 PM UTC</code>',
        )
        expect(
            (await sendOne(orderUpdated, { timeZone: 'Europe/Berlin' })).text,
        ).toContain('<code>Oct 1, 2026, 2:00 PM GMT+2</code>')
    })

    it('rejects an unknown time zone when the client is created', () => {
        expect(
            () =>
                new PolarAlertsClient({ ...baseConfig, timeZone: 'Mars/Base' }),
        ).toThrow(RangeError)
    })
})

describe('alert content', () => {
    it('order.created shows no refund for a new order and one subscription link', async () => {
        const message = await sendOne(
            payload('order.created', { ...order, subscriptionId: 'sub_1' }),
        )

        expect(message.text).not.toContain('Refunded Amount')
        expect(message.text.match(/View Subscription/g)).toHaveLength(1)
    })

    it('labels forever discounts', async () => {
        const message = await sendOne(
            payload('subscription.created', subscription),
        )

        expect(message.text).toContain('<b>12.5%</b> off (forever)')
    })

    it('shows the fixed discount amount in the order currency', async () => {
        const message = await sendOne(
            payload('order.paid', { ...order, currency: 'eur' }),
        )

        expect(message.text).toContain('<b>€4.50</b> off')
    })

    it('shows the subscription price in its currency and interval', async () => {
        const message = await sendOne(
            payload('subscription.created', subscription),
        )

        expect(message.text).toContain(
            'Pro Plan</a> (<b>€85.50</b> every 3 months)',
        )
        expect(message.text).toContain(
            '<b>💵 Amount</b> - <b>€85.50</b> every 3 months',
        )
        expect(message.text).not.toContain('$10')
    })

    it('rounds the trial length to whole days', async () => {
        // The fixture's trial ends 3 seconds short of 14 days
        const message = await sendOne(
            payload('subscription.created', subscription),
        )

        expect(message.text).toContain('14 days (until Oct 15, 2026)')
    })

    it('checkout shows the selected product and the customer before they have an ID', async () => {
        const message = await sendOne(payload('checkout.created', checkout))

        expect(message.text).toContain('Pro Plan')
        expect(message.text).not.toContain('Basic Plan')
        expect(message.text).toContain('<code>jane_doe@example.com</code>')
        expect(message.text).toContain('🖥️ Desktop')
        expect(message.text).toContain('>www.google.com</a>')
        expect(message.text).not.toContain('View Customer')
    })

    it('checkout without customer details shows no customer section', async () => {
        const message = await sendOne(
            payload('checkout.created', {
                ...checkout,
                customerName: null,
                customerEmail: null,
                customerBillingAddress: null,
            }),
        )

        expect(message.text).not.toContain('null')
        expect(message.text).not.toContain('jane_doe')
    })

    it('shows a seat member’s email once', async () => {
        const message = await sendOne(
            payload('customer_seat.claimed', { ...seat, member }),
        )

        expect(message.text.match(/bob_smith@example\.com/g)).toHaveLength(1)
    })

    it('refund.updated links to the subscription and customer', async () => {
        const message = await sendOne(payload('refund.updated', refund))

        expect(message.text).toContain('View Subscription')
        expect(message.text).toContain('View Customer')
    })

    it('subscription.updated only alerts when the subscription is past due', async () => {
        expect(
            await send(payload('subscription.updated', subscription)),
        ).toHaveLength(0)
    })
})

describe('default events', () => {
    it.each([
        [
            'subscription.created',
            payload('subscription.created', subscription),
            1,
        ],
        [
            'subscription.updated (past due)',
            payload('subscription.updated', {
                ...subscription,
                status: 'past_due',
            }),
            1,
        ],
        [
            'subscription.active',
            payload('subscription.active', subscription),
            1,
        ],
        ['order.paid', orderPaid, 1],
        ['order.refunded', payload('order.refunded', order), 1],
        ['refund.created', payload('refund.created', refund), 1],
        ['refund.updated', payload('refund.updated', refund), 1],
        ['checkout.created', payload('checkout.created', checkout), 0],
    ] as const)('%s sends %i alert(s)', async (_name, event, count) => {
        expect(await send(event, { events: undefined })).toHaveLength(count)
    })

    it('merges event overrides with the defaults', async () => {
        const events = { 'order.paid': false, 'checkout.created': true }

        expect(await send(orderPaid, { events })).toHaveLength(0)
        expect(
            await send(payload('checkout.created', checkout), { events }),
        ).toHaveLength(1)
        expect(
            await send(payload('subscription.created', subscription), {
                events,
            }),
        ).toHaveLength(1)
    })

    it('skips events without a template', async () => {
        expect(await send(payload('product.created', product))).toHaveLength(0)
    })

    it('rejects unknown event names at compile time', () => {
        const events: PolarAlertsConfig['events'] = {
            // @ts-expect-error typo in the event name
            'subscriptoin.created': false,
        }

        expect(events).toBeDefined()
    })
})
