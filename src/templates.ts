import type { Order } from '@polar-sh/sdk/models/components/order.js';
import type { Subscription } from '@polar-sh/sdk/models/components/subscription.js';
import type { Checkout } from '@polar-sh/sdk/models/components/checkout.js';

import { AlertDescriptionBuilder } from './description-builder';
import { PolarAlertsConfig } from './types';
import { getOrderLink, getSubscriptionLink } from './utils';
import { AlertParams } from './senders/types';

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
            const description = new AlertDescriptionBuilder({
                config,
                escapeMarkdown,
            });

            checkout.products.forEach((product) => {
                description.productInfo(
                    product,
                    product.prices.find((price) => price.amountType === 'fixed')
                        ?.priceAmount ?? 0
                );
            });

            description
                .separator()
                .field('Status', checkout.status.toUpperCase())
                .dateField('Created at', checkout.createdAt)
                .dateField('Expires at', checkout.expiresAt)
                .separator()
                .field(
                    '🏷️ Discount',
                    checkout.discount
                        ? `${checkout.discount.name} ($${checkout.discount.code})`
                        : undefined,
                    'italic'
                )
                .separator()
                .link('View Checkout', getSubscriptionLink(config, checkout.id))
                .separator();

            if (checkout.customerId) {
                description.customerInfo({
                    id: checkout.customerId,
                    name: checkout.customerName,
                    email: checkout.customerEmail,
                    billingAddress: checkout.customerBillingAddress,
                });
            }

            return {
                title: '🛒🆕 Checkout Created',
                description: await description
                    .hashtags(['checkout', 'created'])
                    .build(),
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
            });

            checkout.products.forEach((product) => {
                description.productInfo(
                    product,
                    product.prices.find((price) => price.amountType === 'fixed')
                        ?.priceAmount ?? 0
                );
            });

            description
                .separator()
                .field('Status', checkout.status.toUpperCase())
                .dateField('Created at', checkout.createdAt)
                .dateField('Expires at', checkout.expiresAt)
                .separator()
                .field(
                    '🏷️ Discount',
                    checkout.discount
                        ? `${checkout.discount.name} ($${checkout.discount.code})`
                        : undefined,
                    'italic'
                )
                .separator()
                .link('View Checkout', getSubscriptionLink(config, checkout.id))
                .separator();

            if (checkout.customerId) {
                description.customerInfo({
                    id: checkout.customerId,
                    name: checkout.customerName,
                    email: checkout.customerEmail,
                    billingAddress: checkout.customerBillingAddress,
                });
            }

            return {
                title: '🛒🔁 Checkout Updated',
                description: await description
                    .hashtags(['checkout', 'updated'])
                    .build(),
            };
        },

        ['subscription.created']: async ({
            data: subscription,
        }: {
            data: Subscription;
        }) => ({
            title: '🔁✅ Subscription Created',
            description: await new AlertDescriptionBuilder({
                config,
                escapeMarkdown,
            })
                .productInfo(subscription.product, subscription.amount)
                .separator()
                .dateField('Started on', subscription.startedAt)
                .separator()
                .link(
                    'View Subscription',
                    getSubscriptionLink(config, subscription.id)
                )
                .separator()
                .customerInfo(subscription.customer)
                .hashtags(['subscription', 'created'])
                .build(),
        }),

        ['subscription.canceled']: async ({
            data: subscription,
        }: {
            data: Subscription;
        }) => ({
            title: '🔁❌ Subscription Canceled',
            description: await new AlertDescriptionBuilder({
                config,
                escapeMarkdown,
            })
                .productInfo(subscription.product, subscription.amount)
                .separator()
                .field(
                    '❔ Cancellation reason',
                    subscription.customerCancellationReason?.toUpperCase()
                )
                .field('💬 Comment', subscription.customerCancellationComment)
                .dateField('Started on', subscription.startedAt)
                .dateField('Ends on', subscription.endsAt)
                .separator()
                .link(
                    'View Subscription',
                    getSubscriptionLink(config, subscription.id)
                )
                .separator()
                .customerInfo(subscription.customer)
                .hashtags(['subscription', 'canceled'])
                .build(),
        }),

        ['subscription.uncanceled']: async ({
            data: subscription,
        }: {
            data: Subscription;
        }) => ({
            title: '🔁✅ Subscription Uncanceled',
            description: await new AlertDescriptionBuilder({
                config,
                escapeMarkdown,
            })
                .productInfo(subscription.product, subscription.amount)
                .separator()
                .field('Status', subscription.status.toUpperCase())
                .separator()
                .dateField('Started on', subscription.startedAt)
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
                .customerInfo(subscription.customer)
                .hashtags(['subscription', 'uncanceled'])
                .build(),
        }),

        ['subscription.updated']: async ({
            data: subscription,
        }: {
            data: Subscription;
        }) => {
            if (subscription.status !== 'past_due') {
                return;
            }

            return {
                title: '🔁⚠️ Subscription Payment Past Due',
                description: await new AlertDescriptionBuilder({
                    config,
                    escapeMarkdown,
                })
                    .productInfo(subscription.product, subscription.amount)
                    .separator()
                    .field('Status', subscription.status.toUpperCase())
                    .separator()
                    .dateField('Started on', subscription.startedAt)
                    .dateField(
                        'Current period start',
                        subscription.currentPeriodStart
                    )
                    .dateField(
                        'Current period end',
                        subscription.currentPeriodEnd
                    )
                    .separator()
                    .link(
                        'View Subscription',
                        getSubscriptionLink(config, subscription.id)
                    )
                    .separator()
                    .customerInfo(subscription.customer)
                    .hashtags(['subscription', 'past_due'])
                    .build(),
            };
        },

        ['order.created']: async ({ data: order }: { data: Order }) => {
            if (!order.product) {
                throw new Error('Product not found in order.');
            }

            return {
                title: '💰🆕 Order Created',
                description: await new AlertDescriptionBuilder({
                    config,
                    escapeMarkdown,
                })
                    .productInfo(order.product, order.subtotalAmount)
                    .separator()
                    .field(
                        '🏷️ Discount',
                        order.discount
                            ? `$${order.discountAmount / 100} (${
                                  order.discount?.name || ''
                              })`
                            : undefined,
                        'italic'
                    )
                    .moneyField('💵 Total', order.netAmount)
                    .moneyField(
                        '🏛️ Taxes',
                        order.taxAmount,
                        order.taxAmount > 0
                    )
                    .separator()
                    .field('Status', order.status.toUpperCase())
                    .dateField('Created on', order.createdAt)
                    .separator()
                    .link('View Order', getOrderLink(config, order.id))
                    .separator()
                    .customerInfo(order.customer)
                    .hashtags(['order', 'created'])
                    .build(),
                silent: false,
            };
        },
        ['order.paid']: async ({ data: order }: { data: Order }) => {
            if (!order.product) {
                throw new Error('Product not found in order.');
            }

            return {
                title: '💰 Order Paid',
                description: await new AlertDescriptionBuilder({
                    config,
                    escapeMarkdown,
                })
                    .productInfo(order.product, order.subtotalAmount)
                    .separator()
                    .field(
                        '🏷️ Discount',
                        order.discount
                            ? `$${order.discountAmount / 100} (${
                                  order.discount?.name || ''
                              })`
                            : undefined,
                        'italic'
                    )
                    .moneyField('💵 Total', order.netAmount)
                    .moneyField(
                        '🏛️ Taxes',
                        order.taxAmount,
                        order.taxAmount > 0
                    )
                    .separator()
                    .field('Billing reason', order.billingReason.toUpperCase())
                    .dateField('Paid on', order.createdAt)
                    .separator()
                    .link('View Order', getOrderLink(config, order.id))
                    .separator()
                    .customerInfo(order.customer)
                    .hashtags(['order', 'paid'])
                    .build(),
                silent: order.billingReason === 'subscription_cycle',
            };
        },

        ['order.refunded']: async ({ data: order }: { data: Order }) => {
            if (!order.product) {
                throw new Error('Product not found in order.');
            }

            return {
                title: '💰❌ Order Refunded',
                description: await new AlertDescriptionBuilder({
                    config,
                    escapeMarkdown,
                })
                    .productInfo(order.product, order.subtotalAmount)
                    .separator()
                    .moneyField('💵 Total', order.netAmount)
                    .moneyField(
                        '🏛️ Taxes',
                        order.taxAmount,
                        order.taxAmount > 0
                    )
                    .dateField('Refunded on', order.createdAt)
                    .separator()
                    .link('View Order', getOrderLink(config, order.id))
                    .separator()
                    .customerInfo(order.customer)
                    .hashtags(['order', 'refunded'])
                    .build(),
            };
        },
    };
}
