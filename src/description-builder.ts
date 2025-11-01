import { format } from 'date-fns';
import { getProductLink, getCountryFlag, getCustomerLink } from './utils';
import { PolarAlertsConfig } from './types';
import type { Product } from '@polar-sh/sdk/models/components/product.js';
import type { OrderProduct } from '@polar-sh/sdk/models/components/orderproduct.js';
import type { Customer } from '@polar-sh/sdk/models/components/customer.js';
import type { CheckoutProduct } from '@polar-sh/sdk/models/components/checkoutproduct.js';

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
            const escaped = this.escapeMarkdown(value);
            const formatted =
                format === 'code'
                    ? `\`${escaped}\``
                    : format === 'italic'
                    ? `*${escaped}*`
                    : escaped;
            this.sections.push(`*${label}* - ${formatted}`);
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
        condition: any = true
    ): this {
        if (condition) {
            const text = `*${label}* - *$${amountInCents / 100}*`;
            this.sections.push(text);
        }
        return this;
    }

    productInfo(
        product: Product | CheckoutProduct | OrderProduct,
        amount?: number
    ): this {
        let text = `[${this.escapeMarkdown(product.name)}](${getProductLink(
            this.config,
            product.id
        )})`;
        if (amount !== undefined) {
            text += ` (*$${amount / 100}*`;
            if (product.recurringInterval) {
                text += `/${this.escapeMarkdown(product.recurringInterval)}`;
            }
            text += ')';
        }
        this.sections.push(text);
        return this;
    }

    hashtags(hashtags: string[], condition: boolean = true): this {
        if (condition && hashtags && hashtags.length > 0) {
            const formattedTags = hashtags
                .map((tag) => (tag.startsWith('#') ? tag : `#${tag}`))
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
    }): this {
        const country = customer.billingAddress?.country;
        const flag = country ? getCountryFlag(country) : '';

        let section = `${flag ? `${flag} ` : ''}${this.escapeMarkdown(
            customer.name ?? ''
        )}\n\`${customer.email}\``;

        if (customer.createdAt) {
            section += `\n*Created* - \`${format(customer.createdAt, 'PPP')}\``;
        }
        section += '\n';

        section += `\n🔗 [View Customer](${getCustomerLink(
            this.config,
            customer.id
        )})\n`;

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
