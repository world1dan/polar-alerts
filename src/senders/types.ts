import { PolarAlertsConfig } from '../types';

export interface AlertsSenderConfig {
    waitUntil?: PolarAlertsConfig['waitUntil'];
}

export interface AlertsSender {
    sendAlert(params: AlertParams | Promise<AlertParams>): void;
    escapeMarkdown(text: string): string;
}

export interface AlertParams {
    title: string;
    description?: string;
    // Send silently without a notification sound.
    silent?: boolean;
}
