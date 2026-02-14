import { format } from 'date-fns';
import { getProductLink, getCountryFlag, getCustomerLink } from './utils';
import {
    $PolarAlertsCustomerMetadata,
    DeviceType,
    PolarAlertsConfig,
    PolarAlertsCustomerMetadata,
} from './types';
import type { Product } from '@polar-sh/sdk/models/components/product.js';
import type { OrderProduct } from '@polar-sh/sdk/models/components/orderproduct.js';
import type { Customer } from '@polar-sh/sdk/models/components/customer.js';
import type { CheckoutProduct } from '@polar-sh/sdk/models/components/checkoutproduct.js';
import type { Discount } from '@polar-sh/sdk/models/components/discount.js';
import type { DiscountFixedOnceForeverDuration } from '@polar-sh/sdk/models/components/discountfixedonceforeverduration.js';
import type { DiscountFixedRepeatDuration } from '@polar-sh/sdk/models/components/discountfixedrepeatduration.js';
import type { DiscountPercentageOnceForeverDuration } from '@polar-sh/sdk/models/components/discountpercentageonceforeverduration.js';
import type { DiscountPercentageRepeatDuration } from '@polar-sh/sdk/models/components/discountpercentagerepeatduration.js';
import type { Checkout } from '@polar-sh/sdk/models/components/checkout.js';
import type { ProductPriceFixed } from '@polar-sh/sdk/models/components/productpricefixed.js';
import type { ProductPriceFree } from '@polar-sh/sdk/models/components/productpricefree.js';

type FieldFormat = 'code' | 'italic' | 'plain';

export class AlertDescriptionBuilder {
    private sections: Array<string | Promise<string>> = [];
    private config: PolarAlertsConfig;
    private escapeMarkdown: (text: string) => string;

    constructor({
        config,
        escapeMarkdown,
    }: {
        config: PolarAlertsConfig;
        escapeMarkdown: (text: string) => string;
    }) {
        this.config = config;
        this.escapeMarkdown = escapeMarkdown;
    }

    custom(text: string | Promise<string>): this {
        this.sections.push(text);
        return this;
    }

    separator(): this {
        this.sections.push('');
        return this;
    }

    field(
        label: string,
        value: string | undefined | null,
        format: FieldFormat = 'code'
    ): this {
        if (value) {
            const escapedLabel = this.escapeMarkdown(label);

            let formattedValue: string;
            if (format === 'code') {
                // Inside backticks, underscores don't need escaping.
                // We only escape the backtick itself.
                const safeCodeValue = value.replace(/`/g, '\\`');
                formattedValue = `\`${safeCodeValue}\``;
            } else if (format === 'italic') {
                formattedValue = `_${this.escapeMarkdown(value)}_`;
            } else {
                formattedValue = this.escapeMarkdown(value);
            }

            this.sections.push(`*${escapedLabel}* - ${formattedValue}`);
        }
        return this;
    }

    dateField(
        label: string,
        date: Date | null | undefined,
        dateFormat: string = 'MMM d, yyyy h:mm a'
    ): this {
        if (date) {
            this.field(label, format(date, dateFormat));
        }
        return this;
    }

    moneyField(
        label: string,
        amountInCents: number,
        condition: any = true,
        recurringInterval?: string | null
    ): this {
        if (condition) {
            let text = `*${label}* - *$${amountInCents / 100}*`;
            if (recurringInterval) {
                text += `/${this.escapeMarkdown(recurringInterval)}`;
            }
            this.sections.push(text);
        }
        return this;
    }

    productInfo(product: Product | CheckoutProduct | OrderProduct): this {
        const price: ProductPriceFixed | ProductPriceFree | undefined =
            'prices' in product
                ? product.prices.find(
                      (p) => p.amountType == 'fixed' || p.amountType === 'free'
                  )
                : undefined;

        let text = `[${this.escapeMarkdown(product.name)}](${getProductLink(
            this.config,
            product.id
        )})`;

        if (price !== undefined) {
            if (price.amountType === 'free') {
                text += ` (free)`;
            } else {
                text += ` (*$${price.priceAmount / 100}*`;
                if (product.recurringInterval) {
                    text += `/${this.escapeMarkdown(
                        product.recurringInterval
                    )}`;
                }
                text += ')';
            }
        }

        this.sections.push(text);
        return this;
    }

    productsInfo(products: (Product | CheckoutProduct | OrderProduct)[]): this {
        products.forEach((product) => {
            this.productInfo(product);
        });

        return this;
    }

    discountInfo(
        discount: Discount | Checkout['discount'] | undefined | null,
        discountAmount?: number
    ): this {
        if (!discount) {
            return this;
        }

        let text = '🏷️ *Discount* - ';

        // Name and code
        text += `*${this.escapeMarkdown(discount.name)}*`;
        if (discount.code) {
            text += ` (\`${this.escapeMarkdown(discount.code)}\`)`;
        }

        // Amount
        if (isFixedDiscount(discount)) {
            text += `\n       - *$${discount.amount / 100}* off`;
        }

        if (isPercentageDiscount(discount)) {
            const percentage = discount.basisPoints / 100;
            text += `\n       - *${percentage}%* off`;
        }

        // Duration
        if (isOnceForeverDiscount(discount)) {
            if (discount.duration == 'once') {
                text += ' (one-time)';
            }

            if (discount.duration == 'forever') {
                text += ' (forever)';
            }
        }

        if (isRepeatingDiscount(discount)) {
            text += ` (for ${discount.durationInMonths} month${
                discount.durationInMonths > 1 ? 's' : ''
            })`;
        }

        // Actual discount amount applied (if provided)
        if (discountAmount !== undefined && discountAmount > 0) {
            text += `\n       - *Savings* - *-$${discountAmount / 100}*`;
        }

        this.sections.push(text);
        return this;
    }

    hashtags(hashtags: string[], condition: boolean = true): this {
        if (condition && hashtags && hashtags.length > 0) {
            const formattedTags = hashtags
                .map((tag) =>
                    this.escapeMarkdown(tag.startsWith('#') ? tag : `#${tag}`)
                )
                .join(' ');
            this.sections.push(formattedTags);
        }
        return this;
    }

    link(label: string, url: string, condition: boolean = true): this {
        if (condition && label && url) {
            this.sections.push(`🔗 [${this.escapeMarkdown(label)}](${url})`);
        }
        return this;
    }

    customerInfo(customer: {
        id: string;
        name?: string | null;
        email?: string | null;
        billingAddress?: Customer['billingAddress'];
        createdAt?: Date;
        metadata?: object;
    }): this {
        const metadataResult = $PolarAlertsCustomerMetadata.safeParse(
            customer.metadata
        );

        const metadata: PolarAlertsCustomerMetadata = metadataResult.success
            ? metadataResult.data
            : {};

        const deviceEmoji = metadata.deviceType
            ? DEVICE_EMOJIS[metadata.deviceType]
            : '';

        const deviceString = metadata.deviceType
            ? `${deviceEmoji ? deviceEmoji + ' ' : ''}${
                  metadata.deviceType.charAt(0).toUpperCase() +
                  metadata.deviceType.slice(1)
              }`
            : '';

        const country = customer.billingAddress?.country;
        const flag = country ? getCountryFlag(country) : '';

        let section = `${flag ? `${flag} ` : ''}${this.escapeMarkdown(
            customer.name ?? ''
        )}\n\`${customer.email}\``;

        if (customer.createdAt) {
            section += `\n\n*Created* - \`${format(
                customer.createdAt,
                'PPP'
            )}\``;
        }

        if (deviceString) {
            section += `\n*Device* - \`${deviceString}\``;
        }

        section += '\n';

        section += `\n🔗 [View Customer](${getCustomerLink(
            this.config,
            customer.id
        )})`;

        this.sections.push(section);

        return this;
    }

    async build(): Promise<string> {
        const sectionPromises = this.sections.map(async (section) => {
            if (typeof section === 'string') {
                return Promise.resolve(section);
            }
            return section;
        });

        const sections = await Promise.all(sectionPromises);
        return sections.join('\n');
    }
}

const DEVICE_EMOJIS: Record<DeviceType, string> = {
    mobile: '📱',
    tablet: '🔳',
    desktop: '🖥️',
};

function isFixedDiscount(
    discount: Discount | NonNullable<Checkout['discount']>
): discount is DiscountFixedOnceForeverDuration | DiscountFixedRepeatDuration {
    return discount.type === 'fixed';
}

function isPercentageDiscount(
    discount: Discount | NonNullable<Checkout['discount']>
): discount is
    | DiscountPercentageOnceForeverDuration
    | DiscountPercentageRepeatDuration {
    return discount.type === 'percentage';
}

function isOnceForeverDiscount(
    discount: Discount | NonNullable<Checkout['discount']>
): discount is
    | DiscountFixedOnceForeverDuration
    | DiscountPercentageOnceForeverDuration {
    return discount.duration === 'once';
}

function isRepeatingDiscount(
    discount: Discount | NonNullable<Checkout['discount']>
): discount is DiscountFixedRepeatDuration | DiscountPercentageRepeatDuration {
    return discount.duration === 'repeating';
}
