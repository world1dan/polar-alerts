import { AlertDescriptionBuilder } from './description-builder'
import { AlertParams, AlertsSender, TelegramAlertSender } from './senders'
import { AlertTemplates, createAlertTemplates } from './templates'
import {
    EventType,
    PolarAlertsConfig,
    PolarAlertsErrorContext,
    WebhookPayload,
} from './types'

/**
 * Which events alert by default. Listing every event type means a new event in the
 * SDK fails type-checking here until a default is chosen for it.
 */
const DEFAULT_EVENT_CONFIG: Record<EventType, boolean> = {
    'checkout.created': false,
    'checkout.updated': false,
    'checkout.expired': false,
    'subscription.created': true,
    'subscription.active': false,
    'subscription.updated': false,
    'subscription.past_due': true,
    'subscription.canceled': true,
    'subscription.uncanceled': true,
    'subscription.revoked': false,
    'order.created': false,
    'order.paid': true,
    'order.updated': false,
    'order.refunded': true,
    'refund.created': true,
    'refund.updated': true,
    'customer.created': false,
    'customer.updated': false,
    'customer.deleted': false,
    'customer.state_changed': false,
    'customer_seat.assigned': true,
    'customer_seat.claimed': false,
    'customer_seat.revoked': true,
    'member.created': false,
    'member.updated': false,
    'member.deleted': false,
    'benefit.created': false,
    'benefit.updated': false,
    'benefit_grant.created': false,
    'benefit_grant.updated': false,
    'benefit_grant.cycled': false,
    'benefit_grant.revoked': false,
    'product.created': false,
    'product.updated': false,
    'organization.updated': false,
}

export class PolarAlertsClient {
    private senders: AlertsSender[] = []
    private config: PolarAlertsConfig
    private templates: AlertTemplates

    constructor(config: PolarAlertsConfig) {
        if (config.timeZone) {
            // Throws a RangeError for an unknown time zone, so typos surface at startup
            // rather than when the first alert is formatted.
            new Intl.DateTimeFormat('en-US', { timeZone: config.timeZone })
        }

        this.config = config
        this.templates = createAlertTemplates(config)

        if (config.telegram) {
            this.senders.push(new TelegramAlertSender(config.telegram))
        }
    }

    /**
     * Send a custom alert to every configured channel. `description` is Telegram HTML,
     * so escape dynamic values with `escapeHtml`.
     *
     * Never throws: delivery errors are logged. Resolves once the alert has been
     * delivered, or immediately when `waitUntil` is configured.
     */
    async sendAlert(params: AlertParams | Promise<AlertParams>): Promise<void> {
        await this.run(this.deliver(params))
    }

    /**
     * Handle a Polar webhook event and send the appropriate alert.
     *
     * Never throws, so a broken alert can't fail your webhook handler: errors go to
     * `onError` (or the console), and if an alert can't be built a short fallback
     * alert is sent instead. Resolves once the alert has been delivered, or
     * immediately when `waitUntil` is configured.
     */
    async handleWebhook(payload: WebhookPayload): Promise<void> {
        if (!this.isEventEnabled(payload.type)) {
            return
        }

        await this.run(this.process(payload))
    }

    /** Waits for `task`, or hands it to `waitUntil` when configured. */
    private async run(task: Promise<void>): Promise<void> {
        if (this.config.waitUntil) {
            try {
                this.config.waitUntil(task)
                return
            } catch (error) {
                console.error(
                    '[polar-alerts] waitUntil failed, sending the alert inline:',
                    error,
                )
            }
        }

        await task
    }

    /** Builds and delivers the alert for a webhook. Never rejects. */
    private async process(payload: WebhookPayload): Promise<void> {
        let alert: AlertParams | undefined

        try {
            alert = this.buildAlert(payload)
        } catch (error) {
            await this.reportError(error, {
                stage: 'build',
                eventType: payload.type,
            })
            alert = this.buildFailureAlert(payload, error)
        }

        if (alert) {
            await this.deliver(alert, payload.type)
        }
    }

    private isEventEnabled(eventType: EventType): boolean {
        if (this.config.events === 'all') {
            return true
        }

        return (
            this.config.events?.[eventType] ??
            DEFAULT_EVENT_CONFIG[eventType] ??
            false
        )
    }

    private buildAlert(payload: WebhookPayload): AlertParams | undefined {
        // TypeScript can't correlate `payload.type` with `payload.data` through the
        // template lookup, so widen the template to accept this payload's data.
        const template = this.templates[payload.type] as
            | ((data: WebhookPayload['data']) => AlertParams | undefined)
            | undefined

        return template?.(payload.data)
    }

    private buildFailureAlert(
        payload: WebhookPayload,
        error: unknown,
    ): AlertParams {
        const { id } = payload.data as { id?: unknown }

        return {
            title: `⚠️ Failed to build ${payload.type} alert`,
            description: new AlertDescriptionBuilder(this.config)
                .field('ID', typeof id === 'string' ? id : undefined)
                .field(
                    'Error',
                    error instanceof Error ? error.message : String(error),
                )
                .separator()
                .hashtags(['alert', 'error'])
                .build(),
        }
    }

    /** Sends to every sender. Never rejects, so it's safe to hand to `waitUntil`. */
    private async deliver(
        params: AlertParams | Promise<AlertParams>,
        eventType?: EventType,
    ): Promise<void> {
        let alert: AlertParams
        try {
            alert = await params
        } catch (error) {
            await this.reportError(error, { stage: 'build', eventType })
            return
        }

        const results = await Promise.allSettled(
            this.senders.map((sender) => sender.send(alert)),
        )

        for (const result of results) {
            if (result.status === 'rejected') {
                await this.reportError(result.reason, {
                    stage: 'send',
                    eventType,
                    alert,
                })
            }
        }
    }

    private async reportError(
        error: unknown,
        context: PolarAlertsErrorContext,
    ): Promise<void> {
        if (!this.config.onError) {
            console.error(
                `[polar-alerts] Failed to ${context.stage} alert${
                    context.eventType ? ` for ${context.eventType}` : ''
                }:`,
                error,
            )
            return
        }

        try {
            await this.config.onError(error, context)
        } catch (onErrorFailure) {
            console.error(
                '[polar-alerts] onError threw while handling:',
                error,
                onErrorFailure,
            )
        }
    }
}
