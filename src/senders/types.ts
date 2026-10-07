export interface AlertsSender {
    /** Delivers the alert. Rejects if it couldn't be delivered. */
    send(alert: AlertParams): Promise<void>
}

export interface AlertParams {
    /** Plain-text title, shown in bold. */
    title: string
    /**
     * Alert body in Telegram HTML (`<b>`, `<i>`, `<code>`, `<pre>`, `<a href>`).
     * Escape any dynamic values with `escapeHtml`.
     */
    description?: string
    /** Send without a notification sound. */
    silent?: boolean
}
