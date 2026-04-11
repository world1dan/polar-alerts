import type { Order } from '@polar-sh/sdk/models/components/order.js';
import type { Subscription } from '@polar-sh/sdk/models/components/subscription.js';
import type { Checkout } from '@polar-sh/sdk/models/components/checkout.js';
import type { Customer } from '@polar-sh/sdk/models/components/customer.js';
import type { Refund } from '@polar-sh/sdk/models/components/refund.js';

import { AlertDescriptionBuilder } from './description-builder';
import { PolarAlertsConfig } from './types';
import {
    getOrderLink,
    getSubscriptionLink,
    getCustomerLink,
    getCheckoutLink,
} from './utils';
import { AlertParams } from './senders/types';
import { endOfDay, format, formatDuration, intervalToDuration } from 'date-fns';

export function createAlertTemplates({
    config,
    escapeMarkdown,
}: {
    config: PolarAlertsConfig;
    escapeMarkdown: (text: string) => string;
}): Record<
    string,
    (params: { data: any }) => Promise<AlertParams | undefined>
> {
    return {
        ['checkout.created']: async ({
            data: checkout,
        }: {
            data: Checkout;
        }) => {
            checkout.metadata;
            const description = new AlertDescriptionBuilder({
                config,
                escapeMarkdown,
            })
                .productsInfo(checkout.products)
                .separator()
                .field('Status', checkout.status.toUpperCase())
                .dateField('Created at', checkout.createdAt)
                .dateField('Expires at', checkout.expiresAt)
                .separator()
                .moneyField(
                    '🧾 Subtotal',
                    checkout.amount,
                    checkout.amount !== checkout.totalAmount,
                    undefined,
                    checkout.currency
                )
                .discountInfo(
                    checkout.discount,
                    checkout.discountAmount,
                    checkout.currency
                )
                .moneyField(
                    '🏛️ Tax',
                    checkout.taxAmount ?? 0,
                    checkout.taxAmount !== null && checkout.taxAmount > 0,
                    undefined,
                    checkout.currency
                )
                .moneyField(
                    '💰 Total',
                    checkout.totalAmount,
                    true,
                    undefined,
                    checkout.currency
                )
                .separator()
                .link('View Checkout', getCheckoutLink(config, checkout.id));

            // Customer information
            if (checkout.customerId) {
                description.separator().customerInfo({
                    id: checkout.customerId,
                    name: checkout.customerName,
                    email: checkout.customerEmail,
                    billingAddress: checkout.customerBillingAddress,
                });
            }

            // Custom fields data
            if (
                checkout.customFieldData &&
                Object.keys(checkout.customFieldData).length > 0
            ) {
                description
                    .separator()
                    .field(
                        'Custom Fields',
                        JSON.stringify(checkout.customFieldData, null, 2),
                        'code'
                    );
            }

            // Metadata
            if (
                checkout.metadata &&
                Object.keys(checkout.metadata).length > 0
            ) {
                description
                    .separator()
                    .field(
                        'Metadata',
                        JSON.stringify(checkout.metadata, null, 2),
                        'code'
                    );
            }

            return {
                title: '🛒🆕 Checkout Created',
                description: await description
                    .separator()
                    .hashtags(['checkout', 'created'])
                    .build(),
                silent: true,
            };
        },

        ['checkout.updated']: async ({
            data: checkout,
        }: {
            data: Checkout;
        }) => {
            const description = new AlertDescriptionBuilder({
                config,
                escapeMarkdown,
            })
                .productsInfo(checkout.products)
                .separator()
                .field('Status', checkout.status.toUpperCase())
                .dateField('Created at', checkout.createdAt)
                .dateField('Expires at', checkout.expiresAt)
                .separator()
                .moneyField(
                    '🧾 Subtotal',
                    checkout.amount,
                    checkout.amount !== checkout.totalAmount,
                    undefined,
                    checkout.currency
                )
                .discountInfo(
                    checkout.discount,
                    checkout.discountAmount,
                    checkout.currency
                )
                .moneyField(
                    '🏛️ Tax',
                    checkout.taxAmount ?? 0,
                    checkout.taxAmount !== null && checkout.taxAmount > 0,
                    undefined,
                    checkout.currency
                )
                .moneyField(
                    '💰 Total',
                    checkout.totalAmount,
                    true,
                    undefined,
                    checkout.currency
                )
                .separator()
                .link('View Checkout', getCheckoutLink(config, checkout.id));

            // Customer
            if (checkout.customerId) {
                description.separator().customerInfo({
                    id: checkout.customerId,
                    name: checkout.customerName,
                    email: checkout.customerEmail,
                    billingAddress: checkout.customerBillingAddress,
                });
            }

            if (
                checkout.metadata &&
                Object.keys(checkout.metadata).length > 0
            ) {
                description
                    .separator()
                    .field(
                        'Metadata',
                        JSON.stringify(checkout.metadata, null, 2),
                        'code'
                    );
            }

            return {
                title:
                    checkout.status === 'succeeded'
                        ? '🛒✅ Checkout Succeeded'
                        : '🛒🔁 Checkout Updated',
                description: await description
                    .separator()
                    .hashtags([
                        'checkout',
                        checkout.status === 'succeeded'
                            ? 'succeeded'
                            : 'updated',
                    ])
                    .build(),
                silent: true,
            };
        },

        ['subscription.created']: async ({
            data: subscription,
        }: {
            data: Subscription;
        }) => {
            const description = new AlertDescriptionBuilder({
                config,
                escapeMarkdown,
            })
                .productInfo(subscription.product)
                .separator()
                .field('Status', subscription.status.toUpperCase())
                .dateField('Started on', subscription.startedAt)
                .separator()
                .discountInfo(
                    subscription.discount,
                    undefined,
                    subscription.currency
                )
                .moneyField(
                    '💵 Amount',
                    subscription.amount,
                    true,
                    subscription.recurringInterval,
                    subscription.currency
                );

            subscriptionTrial(subscription, description);

            // Seat information (if applicable)
            if (subscription.seats) {
                description
                    .separator()
                    .field('👥 Seats', subscription.seats.toString());
            }

            description
                .separator()
                .dateField(
                    'Current period start',
                    subscription.currentPeriodStart
                )
                .dateField('Current period end', subscription.currentPeriodEnd)
                .separator()
                .link(
                    'View Subscription',
                    getSubscriptionLink(config, subscription.id)
                )
                .separator()
                .customerInfo(subscription.customer);

            if (
                subscription.metadata &&
                Object.keys(subscription.metadata).length > 0
            ) {
                description
                    .separator()
                    .field(
                        'Metadata',
                        JSON.stringify(subscription.metadata, null, 2),
                        'code'
                    );
            }

            return {
                title: '🔁✅ Subscription Created',
                description: await description
                    .separator()
                    .hashtags(['subscription', 'created'])
                    .build(),
                silent: true,
            };
        },

        ['subscription.updated']: async ({
            data: subscription,
        }: {
            data: Subscription;
        }) => {
            // Only notify on past_due status
            if (subscription.status !== 'past_due') {
                return;
            }

            const description = new AlertDescriptionBuilder({
                config,
                escapeMarkdown,
            })
                .productInfo(subscription.product)
                .separator()
                .field('Status', subscription.status.toUpperCase(), 'code')
                .dateField('Started on', subscription.startedAt)
                .separator()
                .discountInfo(
                    subscription.discount,
                    undefined,
                    subscription.currency
                )
                .moneyField(
                    '💵 Amount',
                    subscription.amount,
                    true,
                    subscription.recurringInterval,
                    subscription.currency
                );

            subscriptionTrial(subscription, description);

            description
                .dateField(
                    'Current period start',
                    subscription.currentPeriodStart
                )
                .dateField('Current period end', subscription.currentPeriodEnd)
                .separator()
                .link(
                    'View Subscription',
                    getSubscriptionLink(config, subscription.id)
                )
                .separator()
                .customerInfo(subscription.customer);

            return {
                title: '🔁⚠️ Subscription Payment Past Due',
                description: await description
                    .separator()
                    .hashtags(['subscription', 'past_due'])
                    .build(),
                silent: true,
            };
        },

        ['subscription.active']: async ({
            data: subscription,
        }: {
            data: Subscription;
        }) => {
            const description = new AlertDescriptionBuilder({
                config,
                escapeMarkdown,
            })
                .productInfo(subscription.product)
                .separator()
                .field('Status', subscription.status.toUpperCase(), 'code')
                .dateField('Started on', subscription.startedAt)
                .separator()
                .discountInfo(
                    subscription.discount,
                    undefined,
                    subscription.currency
                )
                .moneyField(
                    '💵 Amount',
                    subscription.amount,
                    true,
                    subscription.recurringInterval,
                    subscription.currency
                )
                .separator();

            subscriptionTrial(subscription, description);

            description
                .dateField(
                    'Current period start',
                    subscription.currentPeriodStart
                )
                .dateField('Current period end', subscription.currentPeriodEnd)
                .separator()
                .link(
                    'View Subscription',
                    getSubscriptionLink(config, subscription.id)
                )
                .separator()
                .customerInfo(subscription.customer);

            return {
                title: '🔁✅ Subscription Active',
                description: await description
                    .separator()
                    .hashtags(['subscription', 'active'])
                    .build(),
                silent: true,
            };
        },

        ['subscription.canceled']: async ({
            data: subscription,
        }: {
            data: Subscription;
        }) => {
            // Avoid sending duplicate notifications for subscriptions transitioning from "Ends on period end" to "Canceled".
            // Only send an alert when the user initiates the cancellation, not when the cancellation is automatically finalized.
            if (subscription.status === 'canceled') {
                return;
            }

            const description = new AlertDescriptionBuilder({
                config,
                escapeMarkdown,
            })
                .productInfo(subscription.product)
                .separator()
                .field(
                    'Status',
                    `${subscription.status.toUpperCase()}${
                        subscription.cancelAtPeriodEnd ? ' (Canceled)' : ''
                    }`,
                    'code'
                );

            if (subscription.canceledAt) {
                description.dateField('Canceled on', subscription.canceledAt);
            }

            // Cancellation reason
            if (subscription.customerCancellationReason) {
                description.field(
                    '❔ Cancellation reason',
                    subscription.customerCancellationReason.toUpperCase()
                );
            }
            if (subscription.customerCancellationComment) {
                description.field(
                    '💬 Comment',
                    subscription.customerCancellationComment
                );
            }

            description
                .separator()
                .discountInfo(
                    subscription.discount,
                    undefined,
                    subscription.currency
                )
                .moneyField(
                    '💵 Amount',
                    subscription.amount,
                    true,
                    subscription.recurringInterval,
                    subscription.currency
                );

            subscriptionTrial(subscription, description);

            description
                .separator()
                .dateField('Started on', subscription.startedAt);

            if (subscription.endsAt) {
                description.dateField('Ends on', subscription.endsAt);
            }

            description
                .separator()
                .link(
                    'View Subscription',
                    getSubscriptionLink(config, subscription.id)
                )
                .separator()
                .customerInfo(subscription.customer);

            if (
                subscription.metadata &&
                Object.keys(subscription.metadata).length > 0
            ) {
                description
                    .separator()
                    .field(
                        'Metadata',
                        JSON.stringify(subscription.metadata, null, 2),
                        'code'
                    );
            }

            return {
                title: '🔁❌ Subscription Canceled',
                description: await description
                    .separator()
                    .hashtags(['subscription', 'canceled'])
                    .build(),
                silent: true,
            };
        },

        ['subscription.revoked']: async ({
            data: subscription,
        }: {
            data: Subscription;
        }) => {
            const description = new AlertDescriptionBuilder({
                config,
                escapeMarkdown,
            })
                .productInfo(subscription.product)
                .separator()
                .field('Status', subscription.status.toUpperCase(), 'code');

            subscriptionTrial(subscription, description);

            description
                .separator()
                .dateField('Started on', subscription.startedAt);

            if (subscription.endsAt) {
                description.dateField('Ended on', subscription.endsAt);
            }

            description
                .separator()
                .discountInfo(
                    subscription.discount,
                    undefined,
                    subscription.currency
                )
                .moneyField(
                    '💵 Amount',
                    subscription.amount,
                    true,
                    subscription.recurringInterval,
                    subscription.currency
                )
                .separator()
                .link(
                    'View Subscription',
                    getSubscriptionLink(config, subscription.id)
                )
                .separator()
                .customerInfo(subscription.customer);

            return {
                title: '🔁🚫 Subscription Revoked',
                description: await description
                    .separator()
                    .hashtags(['subscription', 'revoked'])
                    .build(),
                silent: true,
            };
        },

        ['subscription.uncanceled']: async ({
            data: subscription,
        }: {
            data: Subscription;
        }) => {
            const description = new AlertDescriptionBuilder({
                config,
                escapeMarkdown,
            })
                .productInfo(subscription.product)
                .separator()
                .field('Status', subscription.status.toUpperCase(), 'code')
                .dateField('Started on', subscription.startedAt)
                .separator()
                .discountInfo(
                    subscription.discount,
                    undefined,
                    subscription.currency
                )
                .moneyField(
                    '💵 Amount',
                    subscription.amount,
                    true,
                    subscription.recurringInterval,
                    subscription.currency
                );

            subscriptionTrial(subscription, description);

            description
                .separator()
                .dateField(
                    'Current period start',
                    subscription.currentPeriodStart
                )
                .dateField('Current period end', subscription.currentPeriodEnd)
                .separator()
                .separator()
                .link(
                    'View Subscription',
                    getSubscriptionLink(config, subscription.id)
                )
                .separator()
                .customerInfo(subscription.customer);

            return {
                title: '🔁✅ Subscription Uncanceled',
                description: await description
                    .separator()
                    .hashtags(['subscription', 'uncanceled'])
                    .build(),
                silent: true,
            };
        },

        ['order.created']: async ({ data: order }: { data: Order }) => {
            if (!order.product) {
                throw new Error('Product not found in order.');
            }

            const description = new AlertDescriptionBuilder({
                config,
                escapeMarkdown,
            });

            description
                .productInfo(order.product)
                .separator()
                .field('Status', order.status.toUpperCase())
                .dateField('Created on', order.createdAt)
                .separator()
                .moneyField(
                    '🔙 Refunded Amount',
                    order.refundedAmount,
                    true,
                    undefined,
                    order.currency
                )
                .moneyField(
                    '🏛️ Refunded Tax',
                    order.refundedTaxAmount,
                    order.refundedTaxAmount !== 0,
                    undefined,
                    order.currency
                )
                .moneyField(
                    '💳 Platform Fee',
                    order.platformFeeAmount,
                    order.platformFeeAmount !== 0,
                    undefined,
                    order.platformFeeCurrency ?? order.currency
                )
                .separator()
                .moneyField(
                    '🧾 Subtotal',
                    order.subtotalAmount,
                    order.subtotalAmount !== order.totalAmount,
                    undefined,
                    order.currency
                )
                .discountInfo(
                    order.discount,
                    order.discountAmount,
                    order.currency
                )
                .moneyField(
                    '🏛️ Tax',
                    order.taxAmount ?? 0,
                    order.taxAmount !== null && order.taxAmount > 0,
                    undefined,
                    order.currency
                )
                .moneyField(
                    '💰 Total',
                    order.totalAmount,
                    true,
                    undefined,
                    order.currency
                )
                .separator()
                .field('Billing reason', order.billingReason.toUpperCase())
                .field('Invoice number', order.invoiceNumber, 'code')
                .separator();

            // Subscription info
            if (order.subscriptionId) {
                description.link(
                    'View Subscription',
                    getSubscriptionLink(config, order.subscriptionId)
                );
            }

            description
                .link('View Order', getOrderLink(config, order.id))
                .separator();

            if (order.subscriptionId) {
                description.link(
                    'View Subscription',
                    getSubscriptionLink(config, order.subscriptionId)
                );
            }

            description
                .link(
                    'View Checkout',
                    getCheckoutLink(config, order.checkoutId!),
                    !!order.checkoutId
                )
                .separator()
                .customerInfo(order.customer);

            // Custom fields
            if (
                order.customFieldData &&
                Object.keys(order.customFieldData).length > 0
            ) {
                description
                    .separator()
                    .field(
                        'Custom Fields',
                        JSON.stringify(order.customFieldData, null, 2),
                        'code'
                    );
            }

            if (order.metadata && Object.keys(order.metadata).length > 0) {
                description
                    .separator()
                    .field(
                        'Metadata',
                        JSON.stringify(order.metadata, null, 2),
                        'code'
                    );
            }

            return {
                title: '💰🆕 Order Created',
                description: await description
                    .separator()
                    .hashtags(['order', 'created'])
                    .build(),
                silent: true,
            };
        },

        ['order.paid']: async ({ data: order }: { data: Order }) => {
            if (!order.product) {
                throw new Error('Product not found in order.');
            }

            const description = new AlertDescriptionBuilder({
                config,
                escapeMarkdown,
            });

            description
                .productInfo(order.product)
                .separator()
                .moneyField(
                    '🧾 Subtotal',
                    order.subtotalAmount,
                    order.subtotalAmount !== order.totalAmount,
                    undefined,
                    order.currency
                )
                .discountInfo(
                    order.discount,
                    order.discountAmount,
                    order.currency
                )
                .moneyField(
                    '🏛️ Tax',
                    order.taxAmount ?? 0,
                    order.taxAmount !== null && order.taxAmount > 0,
                    undefined,
                    order.currency
                )
                .moneyField(
                    '💰 Total',
                    order.totalAmount,
                    true,
                    undefined,
                    order.currency
                )
                .separator()
                .field('Billing reason', order.billingReason.toUpperCase())
                .field('Invoice number', order.invoiceNumber, 'code')
                .separator();

            description
                .link('View Order', getOrderLink(config, order.id))
                .separator();

            // Subscription
            if (order.subscriptionId) {
                description.link(
                    'View Subscription',
                    getSubscriptionLink(config, order.subscriptionId)
                );
            }

            description
                .link(
                    'View Checkout',
                    getCheckoutLink(config, order.checkoutId!),
                    !!order.checkoutId
                )
                .separator()
                .customerInfo(order.customer);

            return {
                title: '💰✅ Order Paid',
                description: await description
                    .separator()
                    .hashtags(['order', 'paid'])
                    .build(),
                silent: false,
            };
        },

        ['order.refunded']: async ({ data: order }: { data: Order }) => {
            if (!order.product) {
                throw new Error('Product not found in order.');
            }

            const description = new AlertDescriptionBuilder({
                config,
                escapeMarkdown,
            })
                .productInfo(order.product)
                .separator()
                .field('Status', order.status.toUpperCase(), 'code')
                .separator()
                .moneyField(
                    '🔙 Refunded Amount',
                    order.refundedAmount,
                    true,
                    undefined,
                    order.currency
                )
                .moneyField(
                    '🏛️ Refunded Tax',
                    order.refundedTaxAmount,
                    order.refundedTaxAmount !== 0,
                    undefined,
                    order.currency
                )
                .moneyField(
                    '💳 Platform Fee',
                    order.platformFeeAmount,
                    order.platformFeeAmount !== 0,
                    undefined,
                    order.platformFeeCurrency ?? order.currency
                )
                .separator()
                .custom('Original amount:')
                .moneyField(
                    '🧾 Subtotal',
                    order.subtotalAmount,
                    order.subtotalAmount !== order.totalAmount,
                    undefined,
                    order.currency
                )
                .discountInfo(
                    order.discount,
                    order.discountAmount,
                    order.currency
                )
                .moneyField(
                    '🏛️ Tax',
                    order.taxAmount ?? 0,
                    order.taxAmount !== null && order.taxAmount > 0,
                    undefined,
                    order.currency
                )
                .moneyField(
                    '💰 Total',
                    order.totalAmount,
                    true,
                    undefined,
                    order.currency
                )
                .separator()
                .link('View Order', getOrderLink(config, order.id))
                .separator();

            if (order.subscriptionId) {
                description.link(
                    'View Subscription',
                    getSubscriptionLink(config, order.subscriptionId)
                );
            }

            description
                .link(
                    'View Checkout',
                    getCheckoutLink(config, order.checkoutId!),
                    !!order.checkoutId
                )
                .separator()
                .customerInfo(order.customer);

            return {
                title: '💰🔙 Order Refunded',
                description: await description
                    .separator()
                    .hashtags(['order', 'refunded'])
                    .build(),
                silent: true,
            };
        },

        ['order.updated']: async ({ data: order }: { data: Order }) => {
            if (!order.product) {
                throw new Error('Product not found in order.');
            }

            const description = new AlertDescriptionBuilder({
                config,
                escapeMarkdown,
            });

            description
                .productInfo(order.product)
                .separator()
                .field('Status', order.status.toUpperCase())
                .dateField('Created on', order.createdAt);

            if (order.modifiedAt) {
                description.dateField('🔁 Updated on', order.modifiedAt);
            }

            description
                .moneyField(
                    '🔙 Refunded Amount',
                    order.refundedAmount,
                    order.refundedAmount !== 0,
                    undefined,
                    order.currency
                )
                .moneyField(
                    '🏛️ Refunded Tax',
                    order.refundedTaxAmount,
                    order.refundedTaxAmount !== 0,
                    undefined,
                    order.currency
                )
                .separator()
                .moneyField(
                    '🧾 Subtotal',
                    order.subtotalAmount,
                    order.subtotalAmount !== order.totalAmount,
                    undefined,
                    order.currency
                )
                .discountInfo(
                    order.discount,
                    order.discountAmount,
                    order.currency
                )
                .moneyField(
                    '🏛️ Tax',
                    order.taxAmount ?? 0,
                    order.taxAmount !== null && order.taxAmount > 0,
                    undefined,
                    order.currency
                )
                .moneyField(
                    '💰 Total',
                    order.totalAmount,
                    true,
                    undefined,
                    order.currency
                )
                .separator()
                .link('View Order', getOrderLink(config, order.id))
                .separator();

            if (order.subscriptionId) {
                description.link(
                    'View Subscription',
                    getSubscriptionLink(config, order.subscriptionId)
                );
            }

            description
                .link(
                    'View Checkout',
                    getCheckoutLink(config, order.checkoutId!),
                    !!order.checkoutId
                )
                .separator()
                .customerInfo(order.customer);

            return {
                title: '💰🔁 Order Updated',
                description: await description
                    .separator()
                    .hashtags(['order', 'updated'])
                    .build(),
                silent: true,
            };
        },

        ['refund.created']: async ({ data: refund }: { data: Refund }) => {
            const description = new AlertDescriptionBuilder({
                config,
                escapeMarkdown,
            })
                .field('Status', refund.status.toUpperCase())
                .field('Reason', refund.reason.toUpperCase())
                .dateField('Created on', refund.createdAt)
                .separator()
                .moneyField(
                    '🔙 Refund Amount',
                    refund.amount,
                    true,
                    undefined,
                    refund.currency
                )
                .moneyField(
                    '🏛️ Tax Refund',
                    refund.taxAmount,
                    refund.taxAmount !== null && refund.taxAmount > 0,
                    undefined,
                    refund.currency
                )
                .separator()
                .link('View Order', getOrderLink(config, refund.orderId));

            if (refund.subscriptionId) {
                description.link(
                    'View Subscription',
                    getSubscriptionLink(config, refund.subscriptionId)
                );
            }

            return {
                title: '🔙🆕 Refund Created',
                description: await description
                    .separator()
                    .hashtags(['refund', 'created'])
                    .build(),
                silent: true,
            };
        },

        ['refund.updated']: async ({ data: refund }: { data: Refund }) => {
            const description = new AlertDescriptionBuilder({
                config,
                escapeMarkdown,
            })
                .field('Status', refund.status.toUpperCase())
                .field('Reason', refund.reason.toUpperCase())
                .dateField('Created on', refund.createdAt);

            if (refund.modifiedAt) {
                description.dateField('🔁 Updated on', refund.modifiedAt);
            }

            description
                .separator()
                .moneyField(
                    '🔙 Refund Amount',
                    refund.amount,
                    true,
                    undefined,
                    refund.currency
                )
                .moneyField(
                    '🏛️ Tax Refund',
                    refund.taxAmount,
                    refund.taxAmount !== null && refund.taxAmount > 0,
                    undefined,
                    refund.currency
                )
                .separator()
                .link('View Order', getOrderLink(config, refund.orderId));

            return {
                title: '🔙🔁 Refund Updated',
                description: await description
                    .separator()
                    .hashtags(['refund', 'updated'])
                    .build(),
                silent: true,
            };
        },

        ['customer.created']: async ({
            data: customer,
        }: {
            data: Customer;
        }) => {
            const description = new AlertDescriptionBuilder({
                config,
                escapeMarkdown,
            });

            description
                .field('ID', customer.id, 'code')
                .field('Name', customer.name || customer.email)
                .field('Email', customer.email)
                .dateField('Created on', customer.createdAt);

            if (customer.externalId) {
                description
                    .separator()
                    .field('External ID', customer.externalId);
            }

            if (
                customer.metadata &&
                Object.keys(customer.metadata).length > 0
            ) {
                description
                    .separator()
                    .field(
                        'Metadata',
                        JSON.stringify(customer.metadata, null, 2),
                        'code'
                    );
            }

            description
                .separator()
                .link('View Customer', getCustomerLink(config, customer.id));

            return {
                title: '👤🆕 Customer Created',
                description: await description
                    .separator()
                    .hashtags(['customer', 'created'])
                    .build(),
                silent: true,
            };
        },

        ['customer.updated']: async ({
            data: customer,
        }: {
            data: Customer;
        }) => {
            const description = new AlertDescriptionBuilder({
                config,
                escapeMarkdown,
            });

            description.field('ID', customer.id, 'code');

            if (customer.externalId) {
                description.field('External ID', customer.externalId);
            }

            description
                .field('Name', customer.name || customer.email)
                .field('Email', customer.email);

            if (customer.modifiedAt) {
                description
                    .separator()
                    .dateField('Updated at', customer.modifiedAt);
            }

            if (
                customer.metadata &&
                Object.keys(customer.metadata).length > 0
            ) {
                description
                    .separator()
                    .field(
                        'Metadata',
                        JSON.stringify(customer.metadata, null, 2),
                        'code'
                    );
            }

            description
                .separator()
                .link('View Customer', getCustomerLink(config, customer.id));

            return {
                title: '👤🔁 Customer Updated',
                description: await description
                    .separator()
                    .hashtags(['customer', 'updated'])
                    .build(),
                silent: true,
            };
        },

        ['customer.deleted']: async ({
            data: customer,
        }: {
            data: Customer;
        }) => {
            const description = new AlertDescriptionBuilder({
                config,
                escapeMarkdown,
            });

            description
                .field('ID', customer.id, 'code')
                .field('Name', customer.name || customer.email)
                .field('Email', customer.email);

            if (customer.deletedAt) {
                description.dateField('❌ Deleted at', customer.deletedAt);
            }

            return {
                title: '👤❌ Customer Deleted',
                description: await description
                    .separator()
                    .hashtags(['customer', 'deleted'])
                    .build(),
                silent: true,
            };
        },
    };
}

function subscriptionTrial(
    subscription: Subscription,
    description: AlertDescriptionBuilder
): void {
    if (
        subscription.status === 'trialing' &&
        subscription.trialStart &&
        subscription.trialEnd
    ) {
        const duration = formatDuration(
            intervalToDuration({
                start: subscription.trialStart,
                end: endOfDay(subscription.trialEnd),
            }),
            {
                zero: false,
                format: ['years', 'months', 'weeks', 'days'],
            }
        );

        description
            .separator()
            .field(
                '🎁 Trial',
                `${duration} (until ${format(
                    subscription.trialEnd,
                    'MMM d, yyyy'
                )})`
            );
    }
}
