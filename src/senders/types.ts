import { PolarAlertsConfig } from "../types";

export interface AlertsSenderConfig {
  waitUntil?: PolarAlertsConfig["waitUntil"];
}

export interface AlertsSender {
  sendAlert(params: AlertParams | Promise<AlertParams>): void;
  escapeMarkdown(text: string): string;
}

export interface AlertParams {
  title: string;
  description?: string;
  silent?: boolean;
}
