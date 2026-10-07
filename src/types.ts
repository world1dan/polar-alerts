import type { validateEvent } from '@polar-sh/sdk/webhooks'
import * as z from 'zod/v4'

import { TelegramAlertsConfig } from './senders'

export type WebhookPayload = ReturnType<typeof validateEvent>

export type EventType = WebhookPayload['type']

export type EventData<T extends EventType> = Extract<
    WebhookPayload,
    { type: T }
>['data']

export const $DeviceType = z.enum(['mobile', 'tablet', 'desktop'])

export type DeviceType = z.infer<typeof $DeviceType>

export const $PolarAlertsCustomerMetadata = z.object({
    deviceType: $DeviceType.optional(),
    referrer: z.string().optional(),
})

export type PolarAlertsCustomerMetadata = z.infer<
    typeof $PolarAlertsCustomerMetadata
>

export interface PolarAlertsConfig {
    /** Your Polar server environment. Used to construct dashboard links. */
    polarServer: 'production' | 'sandbox'
    /**
     * Your Polar organization slug
     */
    polarOrganizationSlug: string
    /**
     * Default ISO 4217 currency code (e.g. `usd`, `eur`) for formatting monetary amounts when a
     * webhook payload does not include a currency. Polar sends `currency` on orders, checkouts,
     * subscriptions, and refunds; this value is mainly a fallback.
     *
     * @default 'usd'
     */
    currency?: string
    /**
     * IANA time zone used to format dates in alerts (e.g. `Europe/Berlin`).
     *
     * @default 'UTC'
     */
    timeZone?: string
    /**
     * Enable/disable specific event types. Events you don't list keep their default.
     * Pass `'all'` to enable every event that has an alert template.
     */
    events?: Partial<Record<EventType, boolean>> | 'all'
    /**
     * Telegram alert configuration options
     */
    telegram?: TelegramAlertsConfig
    /**
     * Optional function to defer execution (e.g., Vercel's waitUntil).
     *
     * When provided, `handleWebhook` returns immediately and the alert is delivered in the
     * background. Otherwise `handleWebhook` resolves once the alert has been delivered.
     *
     * See `waitUntil` documentation in
     * [Vercel](https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package#waituntil) and
     * [Cloudflare](https://developers.cloudflare.com/workers/runtime-apis/context/#waituntil)
     * for more details.
     */
    waitUntil?: (promise: Promise<unknown>) => void | undefined
}
