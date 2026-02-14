import TelegramBot from 'node-telegram-bot-api';
import { AlertsSenderConfig, AlertsSender, AlertParams } from './types';

/**
 * Telegram alert configuration options
 */
export interface TelegramAlertsConfig {
    /**
     * Your Telegram bot token (obtain via @BotFather on Telegram).
     */
    botToken: string;
    /** The chat ID where alerts will be sent. Can be set to a group, channel, or user id. */
    chatId: string;
    /**
     * Optional: Set a thread ID when sending alerts to a specific thread on telegram (group topics).
     */
    threadId?: number | string;
    /**
     * Optional: Send messages without notification sound.
     * If true, alerts will be sent silently.
     */
    silent?: boolean;
}

export class TelegramAlertSender implements AlertsSender {
    constructor(private config: AlertsSenderConfig & TelegramAlertsConfig) {}

    sendAlert(params: AlertParams | Promise<AlertParams>): void {
        const send = async () => {
            const awaitedParams =
                params instanceof Promise ? await params : params;

            const { title, description } = awaitedParams;

            const bot = new TelegramBot(this.config.botToken);

            // Build message
            let message = `*${this.escapeMarkdown(title)}*\n\n`;

            if (description) {
                message += `${description}\n`;
            }

            try {
                await bot.sendMessage(this.config.chatId, message.trim(), {
                    parse_mode: 'Markdown',
                    disable_web_page_preview: true,
                    disable_notification:
                        awaitedParams.silent ?? this.config.silent,
                    message_thread_id: Number(this.config.threadId),
                    link_preview_options: {
                        is_disabled: true,
                    },
                });
            } catch (error) {
                console.error('Failed to send Telegram alert:', error);
                throw new Error(`Failed to send Telegram alert: ${error}`);
            }
        };

        try {
            if (this.config.waitUntil) {
                this.config.waitUntil(send());
            } else {
                send().catch(console.error);
            }
        } catch (error) {
            console.error('Error in sendAlert:', error);
        }
    }

    // This escapeMarkdown method is for Telegram v1 Markdown formatting.
    escapeMarkdown(text: string): string {
        return text
            .replace(/\*/g, '\\*')
            .replace(/_/g, '\\_')
            .replace(/`/g, '\\`')
            .replace(/\[/g, '\\[');
    }
}
