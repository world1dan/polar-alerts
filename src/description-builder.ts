import type { Checkout } from '@polar-sh/sdk/models/components/checkout.js'
import type { CheckoutProduct } from '@polar-sh/sdk/models/components/checkoutproduct.js'
import type { Customer } from '@polar-sh/sdk/models/components/customer.js'
import type { Discount } from '@polar-sh/sdk/models/components/discount.js'
import type { LegacyRecurringProductPrice } from '@polar-sh/sdk/models/components/legacyrecurringproductprice.js'
import type { OrderProduct } from '@polar-sh/sdk/models/components/orderproduct.js'
import type { Product } from '@polar-sh/sdk/models/components/product.js'
import type { ProductPrice } from '@polar-sh/sdk/models/components/productprice.js'

import { bold, code, escapeHtml, isHttpUrl, italic, link, pre } from './html'
import {
    $PolarAlertsCustomerMetadata,
    DeviceType,
    PolarAlertsConfig,
    PolarAlertsCustomerMetadata,
} from './types'
import {
    formatDate,
    formatMoney,
    formatRecurringInterval,
    getCountryFlag,
    getCustomerLink,
    getProductLink,
} from './utils'

type FieldFormat = 'code' | 'italic' | 'plain'

type Price = ProductPrice | LegacyRecurringProductPrice

type AnyDiscount = Discount | NonNullable<Checkout['discount']>

// Keeps metadata and custom fields from pushing the alert past Telegram's 4096-char limit
const MAX_JSON_LENGTH = 1000

/**
 * Builds the HTML body of an alert. Every method escapes the values it's given.
 */
export class AlertDescriptionBuilder {
    private sections: string[] = []
    private config: PolarAlertsConfig

    constructor(config: PolarAlertsConfig) {
        this.config = config
    }

    custom(text: string): this {
        this.sections.push(escapeHtml(text))
        return this
    }

    separator(): this {
        this.sections.push('')
        return this
    }

    field(
        label: string,
        value: string | undefined | null,
        format: FieldFormat = 'code',
    ): this {
        if (value) {
            let formattedValue: string
            if (format === 'code') {
                formattedValue = code(value)
            } else if (format === 'italic') {
                formattedValue = italic(value)
            } else {
                formattedValue = escapeHtml(value)
            }

            this.sections.push(`${bold(label)} - ${formattedValue}`)
        }
        return this
    }

    dateField(label: string, date: Date | null | undefined): this {
        if (date) {
            this.field(label, this.formatDate(date))
        }
        return this
    }

    moneyField(
        label: string,
        amount: number,
        condition: boolean = true,
        recurring?: { interval: string; count?: number | null } | null,
        currency?: string | null,
    ): this {
        if (condition) {
            let text = `${bold(label)} - ${bold(this.formatMoney(amount, currency))}`
            if (recurring) {
                text += escapeHtml(
                    formatRecurringInterval(
                        recurring.interval,
                        recurring.count,
                    ),
                )
            }
            this.sections.push(text)
        }
        return this
    }

    /** Pretty-printed JSON block, truncated so it can't blow up the message. */
    json(
        label: string,
        value: Record<string, unknown> | null | undefined,
    ): this {
        if (value && Object.keys(value).length > 0) {
            let text = JSON.stringify(value, null, 2)
            if (text.length > MAX_JSON_LENGTH) {
                text = `${text.slice(0, MAX_JSON_LENGTH)}\n…`
            }
            this.sections.push(`${bold(label)}\n${pre(text)}`)
        }
        return this
    }

    /**
     * @param options.prices - the prices to pick from, e.g. the subscription's own prices.
     *   Defaults to the product's prices.
     * @param options.currency - only show a price in this currency
     */
    productInfo(
        product: Product | CheckoutProduct | OrderProduct,
        options: { prices?: Price[]; currency?: string | null } = {},
    ): this {
        const prices =
            options.prices ?? ('prices' in product ? product.prices : [])
        const currency = options.currency?.toLowerCase()
        const candidates = prices.filter(
            (p) =>
                !p.isArchived &&
                (!currency || p.priceCurrency.toLowerCase() === currency),
        )
        // Prefer the base price over metered prices
        const price =
            candidates.find((p) => p.amountType !== 'metered_unit') ??
            candidates[0]

        let text = link(product.name, getProductLink(this.config, product.id))

        if (price) {
            text += ` ${this.formatPrice(price, product)}`
        }

        this.sections.push(text)
        return this
    }

    productsInfo(
        products: (Product | CheckoutProduct | OrderProduct)[],
        options: { currency?: string | null } = {},
    ): this {
        products.forEach((product) => {
            this.productInfo(product, options)
        })

        return this
    }

    discountInfo(
        discount: AnyDiscount | undefined | null,
        discountAmount?: number,
        currency?: string | null,
    ): this {
        if (!discount) {
            return this
        }

        let text = `🏷️ ${bold('Discount')} - ${bold(discount.name)}`
        if (discount.code) {
            text += ` (${code(discount.code)})`
        }

        // Amount
        if (discount.type === 'fixed' && 'amount' in discount) {
            // Fixed discounts can define an amount per currency
            const amountInCurrency = currency
                ? discount.amounts?.[currency.toLowerCase()]
                : undefined
            const amount =
                amountInCurrency !== undefined
                    ? formatMoney(amountInCurrency, currency!)
                    : formatMoney(discount.amount, discount.currency)
            text += `\n       - ${bold(amount)} off`
        }

        if (discount.type === 'percentage' && 'basisPoints' in discount) {
            const percentage = discount.basisPoints / 100
            text += `\n       - ${bold(`${percentage}%`)} off`
        }

        // Duration
        if (discount.duration === 'once') {
            text += ' (one-time)'
        } else if (discount.duration === 'forever') {
            text += ' (forever)'
        } else if (
            discount.duration === 'repeating' &&
            'durationInMonths' in discount
        ) {
            text += ` (for ${discount.durationInMonths} month${
                discount.durationInMonths > 1 ? 's' : ''
            })`
        }

        // Actual discount amount applied (if provided)
        if (discountAmount !== undefined && discountAmount > 0) {
            text += `\n       - ${bold('Savings')} - ${bold(
                this.formatMoney(-discountAmount, currency),
            )}`
        }

        this.sections.push(text)
        return this
    }

    hashtags(hashtags: string[], condition: boolean = true): this {
        if (condition && hashtags && hashtags.length > 0) {
            const formattedTags = hashtags
                .map((tag) => escapeHtml(tag.startsWith('#') ? tag : `#${tag}`))
                .join(' ')
            this.sections.push(formattedTags)
        }
        return this
    }

    link(label: string, url: string, condition: boolean = true): this {
        if (condition && label && url) {
            this.sections.push(`🔗 ${link(label, url)}`)
        }
        return this
    }

    customerInfo(customer: {
        /** Omit for customers that don't exist yet, e.g. on an open checkout */
        id?: string | null
        name?: string | null
        email?: string | null
        billingAddress?: Customer['billingAddress']
        createdAt?: Date
        metadata?: object
    }): this {
        const metadataResult = $PolarAlertsCustomerMetadata.safeParse(
            customer.metadata,
        )

        const metadata: PolarAlertsCustomerMetadata = metadataResult.success
            ? metadataResult.data
            : {}

        const country = customer.billingAddress?.country
        const flag = country ? getCountryFlag(country) : ''

        const lines: string[] = []

        const heading = [flag, customer.name ? escapeHtml(customer.name) : '']
            .filter(Boolean)
            .join(' ')
        if (heading) {
            lines.push(heading)
        }
        if (customer.email) {
            lines.push(code(customer.email))
        }

        const details: string[] = []

        if (customer.createdAt) {
            details.push(
                `${bold('Created')} - ${code(this.formatDate(customer.createdAt, 'date'))}`,
            )
        }

        if (metadata.deviceType) {
            const deviceType = metadata.deviceType
            const deviceName =
                deviceType.charAt(0).toUpperCase() + deviceType.slice(1)
            details.push(
                `${bold('Device')} - ${code(`${DEVICE_EMOJIS[deviceType]} ${deviceName}`)}`,
            )
        }

        if (metadata.referrer) {
            const referrer = metadata.referrer
            // The referrer comes from the customer's browser, so only link real web URLs
            const value = isHttpUrl(referrer)
                ? `🌐 ${link(new URL(referrer).hostname, referrer)}`
                : code(referrer)
            details.push(`${bold('Referrer')} - ${value}`)
        }

        if (details.length > 0) {
            lines.push('', ...details)
        }

        if (customer.id) {
            lines.push(
                '',
                `🔗 ${link('View Customer', getCustomerLink(this.config, customer.id))}`,
            )
        }

        if (lines.length > 0) {
            this.sections.push(lines.join('\n'))
        }

        return this
    }

    memberInfo(member: {
        id: string
        name?: string | null
        email: string
        externalId?: string | null
        role?: string
    }): this {
        const lines: string[] = []

        if (member.name) {
            lines.push(escapeHtml(member.name))
        }

        lines.push(code(member.email))

        if (member.role) {
            lines.push(`${bold('Role')} - ${code(member.role.toUpperCase())}`)
        }

        if (member.externalId) {
            lines.push(`${bold('External ID')} - ${code(member.externalId)}`)
        }

        this.sections.push(lines.join('\n'))
        return this
    }

    build(): string {
        // Collapse runs of separators (and drop leading/trailing ones) so that optional
        // sections that end up empty don't leave stacks of blank lines behind.
        const lines: string[] = []
        for (const section of this.sections) {
            if (section === '' && (lines.length === 0 || lines.at(-1) === '')) {
                continue
            }
            lines.push(section)
        }
        while (lines.at(-1) === '') {
            lines.pop()
        }
        return lines.join('\n')
    }

    private formatMoney(amount: number, currency?: string | null): string {
        return formatMoney(amount, currency ?? this.config.currency ?? 'usd')
    }

    private formatDate(date: Date, style?: 'datetime' | 'date'): string {
        return formatDate(date, this.config.timeZone ?? 'UTC', style)
    }

    private formatPrice(
        price: Price,
        product: Product | CheckoutProduct | OrderProduct,
    ): string {
        switch (price.amountType) {
            case 'fixed': {
                let text = `(${bold(this.formatMoney(price.priceAmount, price.priceCurrency))}`
                if (product.recurringInterval) {
                    text += escapeHtml(
                        formatRecurringInterval(
                            product.recurringInterval,
                            product.recurringIntervalCount,
                        ),
                    )
                }
                return `${text})`
            }
            case 'free':
                return '(free)'
            case 'custom':
                return '(pay what you want)'
            case 'seat_based':
                return '(per seat)'
            case 'metered_unit':
                return '(metered)'
            default:
                return ''
        }
    }
}

const DEVICE_EMOJIS: Record<DeviceType, string> = {
    mobile: '📱',
    tablet: '🔳',
    desktop: '🖥️',
}
