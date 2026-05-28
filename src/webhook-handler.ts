import { AlertParams, AlertsSender, TelegramAlertSender } from "./senders";
import { createAlertTemplates } from "./templates";
import { EventType, PolarAlertsConfig } from "./types";
import type { validateEvent } from "@polar-sh/sdk/webhooks";

type WebhookPayload = ReturnType<typeof validateEvent>;

const DEFAULT_EVENT_CONFIG: Record<EventType, boolean> = {
  "checkout.created": false,
  "checkout.updated": false,
  "subscription.created": true,
  "subscription.canceled": true,
  "subscription.uncanceled": true,
  "subscription.updated": true,
  "order.created": false,
  "order.paid": true,
  "order.refunded": true,
  "order.updated": false,
  "refund.created": true,
  "refund.updated": true,
  "customer.created": false,
  "customer.updated": false,
  "customer.deleted": false,
};

export class PolarAlertsClient {
  private senders: AlertsSender[] = [];
  private config: PolarAlertsConfig;

  constructor(config: PolarAlertsConfig) {
    this.config = config;

    if (config.telegram) {
      this.senders.push(
        new TelegramAlertSender({
          ...config.telegram,
          waitUntil: config.waitUntil,
        }),
      );
    }
  }

  async sendAlert(params: AlertParams | Promise<AlertParams>): Promise<void> {
    for (const sender of this.senders) {
      sender.sendAlert(params);
    }
  }

  /**
   * Handle a Polar webhook event and send the appropriate alert
   */
  async handleWebhook(payload: WebhookPayload): Promise<void> {
    const eventType = payload.type;
    const eventConfig =
      this.config.events === "all"
        ? {}
        : {
            ...DEFAULT_EVENT_CONFIG,
            ...this.config.events,
          };

    // Default to true if not explicitly set to false
    const isEventEnabled = (eventName: string) =>
      eventConfig[eventName as keyof typeof eventConfig] ?? true;

    if (!isEventEnabled(eventType)) {
      return;
    }

    try {
      for (const sender of this.senders) {
        const templates = createAlertTemplates({
          config: this.config,
          escapeMarkdown: sender.escapeMarkdown,
        });

        if (templates[eventType]) {
          const alert = await templates[eventType]({
            data: payload.data,
          });

          if (alert) {
            sender.sendAlert(alert);
          }
        }
      }
    } catch (error) {
      console.error(`Error handling webhook event ${eventType}:`, error);
      throw error;
    }
  }
}
