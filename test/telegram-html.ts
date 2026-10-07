import { isHttpUrl } from '../src/html'

const SUPPORTED_TAGS = new Set([
    'b',
    'strong',
    'i',
    'em',
    'u',
    'ins',
    's',
    'strike',
    'del',
    'code',
    'pre',
    'a',
    'blockquote',
    'tg-spoiler',
])

const TOKEN =
    /<(\/?)([a-zA-Z-]+)([^<>]*)>|&(?:lt|gt|amp|quot|#\d+|#x[\da-fA-F]+);|[<>&]/g

/**
 * Checks a message against Telegram's HTML parse mode rules
 * (https://core.telegram.org/bots/api#html-style). Returns the problems found;
 * an empty array means Telegram will accept the markup.
 */
export function validateTelegramHtml(html: string): string[] {
    const problems: string[] = []
    const open: string[] = []

    for (const match of html.matchAll(TOKEN)) {
        const [raw, closing, rawName, attributes = ''] = match

        if (!rawName) {
            if (raw.length === 1) {
                problems.push(`unescaped "${raw}" at index ${match.index}`)
            }
            continue
        }

        const name = rawName.toLowerCase()
        if (!SUPPORTED_TAGS.has(name)) {
            problems.push(`unsupported tag ${raw}`)
            continue
        }

        if (closing) {
            const expected = open.pop()
            if (expected !== name) {
                problems.push(`${raw} closes <${expected ?? 'nothing'}>`)
            }
            continue
        }

        const parent = open.at(-1)
        if (parent === 'code' || (parent === 'pre' && name !== 'code')) {
            problems.push(`${raw} nested inside <${parent}>`)
        }

        if (name === 'a') {
            const href = /^\s+href="([^"]*)"\s*$/.exec(attributes)?.[1]
            const url = href
                ?.replace(/&quot;/g, '"')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&amp;/g, '&')
            if (!url || !isHttpUrl(url)) {
                problems.push(`invalid link ${raw}`)
            }
        } else if (attributes.trim()) {
            problems.push(`unexpected attributes in ${raw}`)
        }

        open.push(name)
    }

    if (open.length > 0) {
        problems.push(`unclosed tags: ${open.join(', ')}`)
    }

    return problems
}
