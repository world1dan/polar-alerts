import { escapeHtml, htmlToText } from '../html'
import { AlertParams, AlertsSender } from './types'

const API_URL = 'https://api.telegram.org'

/** Telegram rejects messages longer than this, counted after the markup is parsed. */
const MAX_MESSAGE_LENGTH = 4096

// Keep delivery well within Polar's webhook timeout when it isn't run via `waitUntil`
const REQUEST_TIMEOUT_MS = 10_000
const MAX_RETRIES_ON_429 = 1
const MAX_RETRY_AFTER_SECONDS = 5

/**
 * Telegram alert configuration options
 */
export interface TelegramAlertsConfig {
    /**
     * Your Telegram bot token (obtain via @BotFather on Telegram).
     */
    botToken: string
    /** The chat ID where alerts will be sent. Can be set to a group, channel, or user id. */
    chatId: string
    /**
     * Optional: Set a thread ID when sending alerts to a specific thread on telegram (group topics).
     */
    threadId?: number | string
    /**
     * Optional: Override whether alerts play a notification sound.
     * `true` sends every alert silently, `false` makes every alert notify.
     * When unset, each alert type uses its own default.
     */
    silent?: boolean
}

/** An error response from the Telegram Bot API. */
export class TelegramApiError extends Error {
    constructor(
        readonly status: number,
        readonly description: string,
        readonly retryAfter?: number,
    ) {
        super(`Telegram API error ${status}: ${description}`)
        this.name = 'TelegramApiError'
    }
}

interface TelegramResponse {
    ok: boolean
    result?: unknown
    description?: string
    parameters?: { retry_after?: number }
}

export class TelegramAlertSender implements AlertsSender {
    constructor(private config: TelegramAlertsConfig) {}

    async send(alert: AlertParams): Promise<void> {
        const html = [
            `<b>${escapeHtml(alert.title)}</b>`,
            alert.description?.trim(),
        ]
            .filter(Boolean)
            .join('\n\n')

        const silent = this.config.silent ?? alert.silent

        // Rather than lose the alert, send it as plain text when it's too long to
        // keep the formatting or when Telegram can't parse the markup.
        if (htmlToText(html).length > MAX_MESSAGE_LENGTH) {
            await this.sendMessage(toPlainText(html), silent)
            return
        }

        try {
            await this.sendMessage(html, silent, 'HTML')
        } catch (error) {
            if (!isEntityParseError(error)) {
                throw error
            }
            console.warn(
                '[polar-alerts] Telegram could not parse the alert, sending it as plain text:',
                error,
            )
            await this.sendMessage(toPlainText(html), silent)
        }
    }

    private async sendMessage(
        text: string,
        silent: boolean | undefined,
        parseMode?: 'HTML',
    ): Promise<void> {
        const { threadId } = this.config

        await this.call('sendMessage', {
            chat_id: this.config.chatId,
            text,
            parse_mode: parseMode,
            message_thread_id:
                threadId != null && threadId !== ''
                    ? Number(threadId)
                    : undefined,
            link_preview_options: { is_disabled: true },
            disable_notification: silent,
        })
    }

    private async call(
        method: string,
        params: Record<string, unknown>,
        attempt = 0,
    ): Promise<unknown> {
        const response = await fetch(
            `${API_URL}/bot${this.config.botToken}/${method}`,
            {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                // `JSON.stringify` drops undefined fields, so unset options aren't sent
                body: JSON.stringify(params),
                signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
            },
        )

        let body: TelegramResponse
        try {
            body = (await response.json()) as TelegramResponse
        } catch {
            // e.g. an HTML error page from a proxy in front of the API
            throw new TelegramApiError(
                response.status,
                response.statusText || 'Invalid response',
            )
        }

        if (body.ok) {
            return body.result
        }

        const retryAfter = body.parameters?.retry_after
        if (
            response.status === 429 &&
            retryAfter !== undefined &&
            retryAfter <= MAX_RETRY_AFTER_SECONDS &&
            attempt < MAX_RETRIES_ON_429
        ) {
            await new Promise((resolve) =>
                setTimeout(resolve, retryAfter * 1000),
            )
            return this.call(method, params, attempt + 1)
        }

        throw new TelegramApiError(
            response.status,
            body.description ?? 'Unknown error',
            retryAfter,
        )
    }
}

function toPlainText(html: string): string {
    const text = htmlToText(html)
    return text.length > MAX_MESSAGE_LENGTH
        ? `${text.slice(0, MAX_MESSAGE_LENGTH - 1)}…`
        : text
}

function isEntityParseError(error: unknown): boolean {
    return (
        error instanceof TelegramApiError &&
        error.description.includes("can't parse entities")
    )
}
