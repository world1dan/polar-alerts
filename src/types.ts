import * as z from "zod/v4";
import { TelegramAlertsConfig } from "./senders";
import { createAlertTemplates } from "./templates";

export type EventType = keyof ReturnType<typeof createAlertTemplates>;

export const $DeviceType = z.enum(["mobile", "tablet", "desktop"]);

export type DeviceType = z.infer<typeof $DeviceType>;

export const $PolarAlertsCustomerMetadata = z.object({
  deviceType: $DeviceType.optional(),
});

export type PolarAlertsCustomerMetadata = z.infer<
  typeof $PolarAlertsCustomerMetadata
>;

export interface PolarAlertsConfig {
  /** Your Polar server environment. Used to construct dashboard links. */
  polarServer: "production" | "sandbox";
  /**
   * Your Polar organization slug
   */
  polarOrganizationSlug: string;
  /**
   * Default ISO 4217 currency code (e.g. `usd`, `eur`) for formatting monetary amounts when a
   * webhook payload does not include a currency. Polar sends `currency` on orders, checkouts,
   * subscriptions, and refunds; this value is mainly a fallback.
   *
   * @default 'usd'
   */
  currency?: string;
  /**
   * Enable/disable specific event types
   */
  events?: Record<EventType, boolean> | "all";
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
  waitUntil?: (promise: Promise<unknown>) => Promise<void>;
}
