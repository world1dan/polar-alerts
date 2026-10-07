/**
 * Helpers for building Telegram HTML messages.
 * See https://core.telegram.org/bots/api#html-style
 *
 * Every helper takes plain text and escapes it, so user-supplied values
 * (names, discount codes, metadata) can never break the message markup.
 */

export function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

export function bold(text: string): string {
    return `<b>${escapeHtml(text)}</b>`
}

export function italic(text: string): string {
    return `<i>${escapeHtml(text)}</i>`
}

export function code(text: string): string {
    return `<code>${escapeHtml(text)}</code>`
}

export function pre(text: string): string {
    return `<pre>${escapeHtml(text)}</pre>`
}

export function link(label: string, url: string): string {
    return `<a href="${escapeHtml(url)}">${escapeHtml(label)}</a>`
}

/** Telegram only accepts http(s) links; anything else makes it reject the message. */
export function isHttpUrl(value: string): boolean {
    try {
        const { protocol } = new URL(value)
        return protocol === 'http:' || protocol === 'https:'
    } catch {
        return false
    }
}

/** The text Telegram displays for a message, which is what its length limit applies to. */
export function htmlToText(html: string): string {
    return html
        .replace(/<[^>]*>/g, '')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
}
