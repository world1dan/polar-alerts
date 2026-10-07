import TelegramBot from 'node-telegram-bot-api'

import { escapeHtml, htmlToText } from '../html'
import { AlertParams, AlertsSender } from './types'

/** Telegram rejects messages longer than this, counted after the markup is parsed. */
const MAX_MESSAGE_LENGTH = 4096

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

export class TelegramAlertSender implements AlertsSender {
    private bot: TelegramBot

    constructor(private config: TelegramAlertsConfig) {
        this.bot = new TelegramBot(config.botToken)
    }

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

        await this.bot.sendMessage(this.config.chatId, text, {
            ...(parseMode && { parse_mode: parseMode }),
            ...(threadId != null &&
                threadId !== '' && { message_thread_id: Number(threadId) }),
            link_preview_options: {
                is_disabled: true,
            },
            disable_notification: silent,
        })
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
        error instanceof Error && error.message.includes("can't parse entities")
    )
}
