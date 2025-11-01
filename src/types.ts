import { TelegramAlertsConfig } from './senders';
import { createAlertTemplates } from './templates';

export type EventType = keyof ReturnType<typeof createAlertTemplates>;

export interface PolarAlertsConfig {
    /** Your Polar server environment. Used to construct dashboard links. */
    polarServer: 'production' | 'sandbox';
    /**
     * Your Polar organization slug
     */
    polarOrganizationSlug: string;
    /**
     * Enable/disable specific event types
     */
    events?: Record<EventType, boolean> | 'all';
    /**
     * Telegram alert configuration options
     */
    telegram?: TelegramAlertsConfig;
    /**
     * Optional function to defer execution (e.g., Vercel's waitUntil)
     * If not provided, alerts may be unreliable in serverless environments.
     *
     * See `waitUntil` documentation in
     * [Vercel](https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package#waituntil) and
     * [Cloudflare](https://developers.cloudflare.com/workers/runtime-apis/context/#waituntil)
     * for more details.
     */
    waitUntil?: (promise: Promise<any>) => void;
}
