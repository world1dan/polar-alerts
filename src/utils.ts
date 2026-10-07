import { PolarAlertsConfig } from './types'

// Amounts are in the currency's smallest unit, which for these currencies is the
// whole unit. Mirrors Polar's own formatting (polarsource/polar clients/packages/currency).
const ZERO_DECIMAL_CURRENCIES = new Set([
    'bif',
    'clp',
    'djf',
    'gnf',
    'jpy',
    'kmf',
    'krw',
    'mga',
    'pyg',
    'rwf',
    'vnd',
    'vuv',
    'xaf',
    'xof',
    'xpf',
])

export function formatMoney(amount: number, currency: string): string {
    const isZeroDecimal = ZERO_DECIMAL_CURRENCIES.has(currency.toLowerCase())
    const value = isZeroDecimal ? amount : amount / 100
    const code = currency.toUpperCase()

    try {
        const formatted = new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: code,
            minimumFractionDigits: isZeroDecimal ? 0 : 2,
        }).format(value)

        // Whole amounts read as "$10" rather than "$10.00", but keep "$10.50"
        return formatted.replace(/\.00$/, '')
    } catch {
        return `${code} ${isZeroDecimal ? value : value.toFixed(2)}`
    }
}

/** Returns the suffix for a recurring amount, e.g. "/month" or " every 3 months". */
export function formatRecurringInterval(
    interval: string,
    count?: number | null,
): string {
    return count && count > 1 ? ` every ${count} ${interval}s` : `/${interval}`
}

export function formatDate(
    date: Date,
    timeZone: string,
    style: 'datetime' | 'date' = 'datetime',
): string {
    const value = new Date(date)
    if (Number.isNaN(value.getTime())) {
        return String(date)
    }

    return new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        ...(style === 'datetime' && {
            hour: 'numeric',
            minute: '2-digit',
            timeZoneName: 'short',
        }),
    }).format(value)
}

export function getCountryFlag(countryCode: string): string {
    if (!/^[a-z]{2}$/i.test(countryCode)) {
        return ''
    }
    const code = countryCode.toUpperCase()
    const codePoints = code.split('').map((char) => 127397 + char.charCodeAt(0))
    return String.fromCodePoint(...codePoints)
}

export function getCustomerLink(
    config: PolarAlertsConfig,
    customerId: string,
): string {
    return polarDashboardLink(config, `customers/${customerId}`)
}

export function getProductLink(
    config: PolarAlertsConfig,
    productId: string,
): string {
    return polarDashboardLink(config, `products/${productId}`)
}

export function getOrderLink(
    config: PolarAlertsConfig,
    orderId: string,
): string {
    return polarDashboardLink(config, `sales/${orderId}`)
}

export function getSubscriptionLink(
    config: PolarAlertsConfig,
    subscriptionId: string,
): string {
    return polarDashboardLink(config, `sales/subscriptions/${subscriptionId}`)
}

export function getCheckoutLink(
    config: PolarAlertsConfig,
    checkoutId: string,
): string {
    return polarDashboardLink(config, `sales/checkouts/${checkoutId}`)
}

function polarDashboardLink(config: PolarAlertsConfig, path: string): string {
    if (config.polarServer === 'production') {
        return `https://polar.sh/dashboard/${config.polarOrganizationSlug}/${path}`
    } else {
        return `https://sandbox.polar.sh/dashboard/${config.polarOrganizationSlug}/${path}`
    }
}
