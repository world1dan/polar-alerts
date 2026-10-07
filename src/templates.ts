import type { Checkout } from '@polar-sh/sdk/models/components/checkout.js'
import type { Order } from '@polar-sh/sdk/models/components/order.js'
import type { Subscription } from '@polar-sh/sdk/models/components/subscription.js'
import { formatDuration, intervalToDuration } from 'date-fns'

import { AlertDescriptionBuilder } from './description-builder'
import { AlertParams } from './senders/types'
import { EventData, EventType, PolarAlertsConfig } from './types'
import {
    formatDate,
    getCheckoutLink,
    getCustomerLink,
    getOrderLink,
    getSubscriptionLink,
} from './utils'

type AlertTemplate<T extends EventType> = (
    data: EventData<T>,
) => AlertParams | undefined

export type AlertTemplates = { [T in EventType]?: AlertTemplate<T> }

export function createAlertTemplates(
    config: PolarAlertsConfig,
): AlertTemplates {
    return {
        ['checkout.created']: (checkout) => {
            const description = new AlertDescriptionBuilder(config)

            checkoutProducts(checkout, description)

            description
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
                    checkout.currency,
                )
                .discountInfo(
                    checkout.discount,
                    checkout.discountAmount,
                    checkout.currency,
                )
                .moneyField(
                    '🏛️ Tax',
                    checkout.taxAmount ?? 0,
                    checkout.taxAmount !== null && checkout.taxAmount > 0,
                    undefined,
                    checkout.currency,
                )
                .moneyField(
                    '💰 Total',
                    checkout.totalAmount,
                    true,
                    undefined,
                    checkout.currency,
                )
                .separator()
                .link('View Checkout', getCheckoutLink(config, checkout.id))

            checkoutCustomer(checkout, description)

            description
                .separator()
                .json('Custom Fields', checkout.customFieldData)
                .separator()
                .json('Metadata', checkout.metadata)

            return {
                title: '🛒🆕 Checkout Created',
                description: description
                    .separator()
                    .hashtags(['checkout', 'created'])
                    .build(),
                silent: true,
            }
        },

        ['checkout.updated']: (checkout) => {
            const description = new AlertDescriptionBuilder(config)

            checkoutProducts(checkout, description)

            description
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
                    checkout.currency,
                )
                .discountInfo(
                    checkout.discount,
                    checkout.discountAmount,
                    checkout.currency,
                )
                .moneyField(
                    '🏛️ Tax',
                    checkout.taxAmount ?? 0,
                    checkout.taxAmount !== null && checkout.taxAmount > 0,
                    undefined,
                    checkout.currency,
                )
                .moneyField(
                    '💰 Total',
                    checkout.totalAmount,
                    true,
                    undefined,
                    checkout.currency,
                )
                .separator()
                .link('View Checkout', getCheckoutLink(config, checkout.id))

            checkoutCustomer(checkout, description)

            description
                .separator()
                .json('Custom Fields', checkout.customFieldData)
                .separator()
                .json('Metadata', checkout.metadata)

            return {
                title:
                    checkout.status === 'succeeded'
                        ? '🛒✅ Checkout Succeeded'
                        : '🛒🔁 Checkout Updated',
                description: description
                    .separator()
                    .hashtags([
                        'checkout',
                        checkout.status === 'succeeded'
                            ? 'succeeded'
                            : 'updated',
                    ])
                    .build(),
                silent: true,
            }
        },

        ['subscription.created']: (subscription) => {
            const description = new AlertDescriptionBuilder(config)
                .productInfo(subscription.product, {
                    prices: subscription.prices,
                    currency: subscription.currency,
                })
                .separator()
                .field('Status', subscription.status.toUpperCase())
                .dateField('Started on', subscription.startedAt)
                .separator()
                .discountInfo(
                    subscription.discount,
                    undefined,
                    subscription.currency,
                )
                .moneyField(
                    '💵 Amount',
                    subscription.amount,
                    true,
                    subscriptionInterval(subscription),
                    subscription.currency,
                )

            subscriptionTrial(subscription, description, config)
            subscriptionSeats(subscription, description)

            description
                .separator()
                .dateField(
                    'Current period start',
                    subscription.currentPeriodStart,
                )
                .dateField('Current period end', subscription.currentPeriodEnd)
                .separator()
                .link(
                    'View Subscription',
                    getSubscriptionLink(config, subscription.id),
                )
                .separator()
                .customerInfo(subscription.customer)
                .separator()
                .json('Metadata', subscription.metadata)

            return {
                title: '🔁✅ Subscription Created',
                description: description
                    .separator()
                    .hashtags(['subscription', 'created'])
                    .build(),
                silent: true,
            }
        },

        ['subscription.updated']: (subscription) => {
            // Only notify on past_due status
            if (subscription.status !== 'past_due') {
                return
            }

            const description = new AlertDescriptionBuilder(config)
                .productInfo(subscription.product, {
                    prices: subscription.prices,
                    currency: subscription.currency,
                })
                .separator()
                .field('Status', subscription.status.toUpperCase(), 'code')
                .dateField('Started on', subscription.startedAt)
                .separator()
                .discountInfo(
                    subscription.discount,
                    undefined,
                    subscription.currency,
                )
                .moneyField(
                    '💵 Amount',
                    subscription.amount,
                    true,
                    subscriptionInterval(subscription),
                    subscription.currency,
                )

            subscriptionTrial(subscription, description, config)
            subscriptionSeats(subscription, description)

            description
                .separator()
                .dateField(
                    'Current period start',
                    subscription.currentPeriodStart,
                )
                .dateField('Current period end', subscription.currentPeriodEnd)
                .separator()
                .link(
                    'View Subscription',
                    getSubscriptionLink(config, subscription.id),
                )
                .separator()
                .customerInfo(subscription.customer)

            return {
                title: '🔁⚠️ Subscription Payment Past Due',
                description: description
                    .separator()
                    .hashtags(['subscription', 'past_due'])
                    .build(),
                silent: true,
            }
        },

        ['subscription.active']: (subscription) => {
            const description = new AlertDescriptionBuilder(config)
                .productInfo(subscription.product, {
                    prices: subscription.prices,
                    currency: subscription.currency,
                })
                .separator()
                .field('Status', subscription.status.toUpperCase(), 'code')
                .dateField('Started on', subscription.startedAt)
                .separator()
                .discountInfo(
                    subscription.discount,
                    undefined,
                    subscription.currency,
                )
                .moneyField(
                    '💵 Amount',
                    subscription.amount,
                    true,
                    subscriptionInterval(subscription),
                    subscription.currency,
                )

            subscriptionTrial(subscription, description, config)
            subscriptionSeats(subscription, description)

            description
                .separator()
                .dateField(
                    'Current period start',
                    subscription.currentPeriodStart,
                )
                .dateField('Current period end', subscription.currentPeriodEnd)
                .separator()
                .link(
                    'View Subscription',
                    getSubscriptionLink(config, subscription.id),
                )
                .separator()
                .customerInfo(subscription.customer)

            return {
                title: '🔁✅ Subscription Active',
                description: description
                    .separator()
                    .hashtags(['subscription', 'active'])
                    .build(),
                silent: true,
            }
        },

        ['subscription.canceled']: (subscription) => {
            // Avoid sending duplicate notifications for subscriptions transitioning from "Ends on period end" to "Canceled".
            // Only send an alert when the user initiates the cancellation, not when the cancellation is automatically finalized.
            if (subscription.status === 'canceled') {
                return
            }

            const description = new AlertDescriptionBuilder(config)
                .productInfo(subscription.product, {
                    prices: subscription.prices,
                    currency: subscription.currency,
                })
                .separator()
                .field(
                    'Status',
                    `${subscription.status.toUpperCase()}${
                        subscription.cancelAtPeriodEnd ? ' (Canceled)' : ''
                    }`,
                    'code',
                )
                .dateField('Canceled on', subscription.canceledAt)

            // Cancellation reason
            if (subscription.customerCancellationReason) {
                description.field(
                    'Cancellation reason',
                    subscription.customerCancellationReason.toUpperCase(),
                )
            }
            if (subscription.customerCancellationComment) {
                description.field(
                    'Comment',
                    subscription.customerCancellationComment,
                )
            }

            description
                .separator()
                .discountInfo(
                    subscription.discount,
                    undefined,
                    subscription.currency,
                )
                .moneyField(
                    '💵 Amount',
                    subscription.amount,
                    true,
                    subscriptionInterval(subscription),
                    subscription.currency,
                )

            subscriptionTrial(subscription, description, config)
            subscriptionSeats(subscription, description)

            description
                .separator()
                .dateField('Started on', subscription.startedAt)
                .dateField('Ends on', subscription.endsAt)
                .separator()
                .link(
                    'View Subscription',
                    getSubscriptionLink(config, subscription.id),
                )
                .separator()
                .customerInfo(subscription.customer)
                .separator()
                .json('Metadata', subscription.metadata)

            return {
                title: '🔁❌ Subscription Canceled',
                description: description
                    .separator()
                    .hashtags(['subscription', 'canceled'])
                    .build(),
                silent: true,
            }
        },

        ['subscription.revoked']: (subscription) => {
            const description = new AlertDescriptionBuilder(config)
                .productInfo(subscription.product, {
                    prices: subscription.prices,
                    currency: subscription.currency,
                })
                .separator()
                .field('Status', subscription.status.toUpperCase(), 'code')

            subscriptionTrial(subscription, description, config)
            subscriptionSeats(subscription, description)

            description
                .separator()
                .dateField('Started on', subscription.startedAt)
                .dateField('Ended on', subscription.endsAt)
                .separator()
                .discountInfo(
                    subscription.discount,
                    undefined,
                    subscription.currency,
                )
                .moneyField(
                    '💵 Amount',
                    subscription.amount,
                    true,
                    subscriptionInterval(subscription),
                    subscription.currency,
                )
                .separator()
                .link(
                    'View Subscription',
                    getSubscriptionLink(config, subscription.id),
                )
                .separator()
                .customerInfo(subscription.customer)

            return {
                title: '🔁🚫 Subscription Revoked',
                description: description
                    .separator()
                    .hashtags(['subscription', 'revoked'])
                    .build(),
                silent: true,
            }
        },

        ['subscription.uncanceled']: (subscription) => {
            const description = new AlertDescriptionBuilder(config)
                .productInfo(subscription.product, {
                    prices: subscription.prices,
                    currency: subscription.currency,
                })
                .separator()
                .field('Status', subscription.status.toUpperCase(), 'code')
                .dateField('Started on', subscription.startedAt)
                .separator()
                .discountInfo(
                    subscription.discount,
                    undefined,
                    subscription.currency,
                )
                .moneyField(
                    '💵 Amount',
                    subscription.amount,
                    true,
                    subscriptionInterval(subscription),
                    subscription.currency,
                )

            subscriptionTrial(subscription, description, config)
            subscriptionSeats(subscription, description)

            description
                .separator()
                .dateField(
                    'Current period start',
                    subscription.currentPeriodStart,
                )
                .dateField('Current period end', subscription.currentPeriodEnd)
                .separator()
                .link(
                    'View Subscription',
                    getSubscriptionLink(config, subscription.id),
                )
                .separator()
                .customerInfo(subscription.customer)

            return {
                title: '🔁✅ Subscription Uncanceled',
                description: description
                    .separator()
                    .hashtags(['subscription', 'uncanceled'])
                    .build(),
                silent: true,
            }
        },

        ['customer_seat.assigned']: (seat) => {
            const description = new AlertDescriptionBuilder(config)
                .field('Status', seat.status.toUpperCase())
                .dateField('Assigned on', seat.createdAt)
                .dateField('Invitation expires', seat.invitationTokenExpiresAt)

            if (seat.member) {
                description.separator().memberInfo(seat.member)
            } else if (seat.email ?? seat.customerEmail) {
                description
                    .separator()
                    .field('Email', seat.email ?? seat.customerEmail)
            }

            description.separator()

            if (seat.subscriptionId) {
                description.link(
                    'View Subscription',
                    getSubscriptionLink(config, seat.subscriptionId),
                )
            }
            if (seat.orderId) {
                description.link(
                    'View Order',
                    getOrderLink(config, seat.orderId),
                )
            }

            description.separator().json('Metadata', seat.seatMetadata)

            return {
                title: '💺🆕 Seat Assigned',
                description: description
                    .separator()
                    .hashtags(['seat', 'assigned'])
                    .build(),
                silent: true,
            }
        },

        ['customer_seat.claimed']: (seat) => {
            const description = new AlertDescriptionBuilder(config)
                .field('Status', seat.status.toUpperCase())
                .dateField('Claimed on', seat.claimedAt)

            if (seat.member) {
                description.separator().memberInfo(seat.member)
            } else if (seat.email ?? seat.customerEmail) {
                description
                    .separator()
                    .field('Email', seat.email ?? seat.customerEmail)
            }

            description.separator()

            if (seat.subscriptionId) {
                description.link(
                    'View Subscription',
                    getSubscriptionLink(config, seat.subscriptionId),
                )
            }
            if (seat.orderId) {
                description.link(
                    'View Order',
                    getOrderLink(config, seat.orderId),
                )
            }

            return {
                title: '💺✅ Seat Claimed',
                description: description
                    .separator()
                    .hashtags(['seat', 'claimed'])
                    .build(),
                silent: false,
            }
        },

        ['customer_seat.revoked']: (seat) => {
            const description = new AlertDescriptionBuilder(config)
                .field('Status', seat.status.toUpperCase())
                .dateField('Revoked on', seat.revokedAt)

            if (seat.member) {
                description.separator().memberInfo(seat.member)
            } else if (seat.email ?? seat.customerEmail) {
                description
                    .separator()
                    .field('Email', seat.email ?? seat.customerEmail)
            }

            description.separator()

            if (seat.subscriptionId) {
                description.link(
                    'View Subscription',
                    getSubscriptionLink(config, seat.subscriptionId),
                )
            }
            if (seat.orderId) {
                description.link(
                    'View Order',
                    getOrderLink(config, seat.orderId),
                )
            }

            return {
                title: '💺🚫 Seat Revoked',
                description: description
                    .separator()
                    .hashtags(['seat', 'revoked'])
                    .build(),
                silent: true,
            }
        },

        ['order.created']: (order) => {
            const description = new AlertDescriptionBuilder(config)

            orderProduct(order, description)

            description
                .separator()
                .field('Status', order.status.toUpperCase())
                .dateField('Created on', order.createdAt)
                .separator()
                .moneyField(
                    '🔙 Refunded Amount',
                    order.refundedAmount,
                    order.refundedAmount !== 0,
                    undefined,
                    order.currency,
                )
                .moneyField(
                    '🏛️ Refunded Tax',
                    order.refundedTaxAmount,
                    order.refundedTaxAmount !== 0,
                    undefined,
                    order.currency,
                )
                .moneyField(
                    '💳 Platform Fee',
                    order.platformFeeAmount,
                    order.platformFeeAmount !== 0,
                    undefined,
                    order.platformFeeCurrency ?? order.currency,
                )
                .separator()
                .moneyField(
                    '🧾 Subtotal',
                    order.subtotalAmount,
                    order.subtotalAmount !== order.totalAmount,
                    undefined,
                    order.currency,
                )
                .discountInfo(
                    order.discount,
                    order.discountAmount,
                    order.currency,
                )
                .moneyField(
                    '🏛️ Tax',
                    order.taxAmount,
                    order.taxAmount > 0,
                    undefined,
                    order.currency,
                )
                .moneyField(
                    '💰 Total',
                    order.totalAmount,
                    true,
                    undefined,
                    order.currency,
                )
                .separator()
                .field('Billing reason', order.billingReason.toUpperCase())
                .field('Invoice number', order.invoiceNumber, 'code')
                .separator()
                .link('View Order', getOrderLink(config, order.id))
                .separator()

            if (order.subscriptionId) {
                description.link(
                    'View Subscription',
                    getSubscriptionLink(config, order.subscriptionId),
                )
            }

            description
                .link(
                    'View Checkout',
                    getCheckoutLink(config, order.checkoutId!),
                    !!order.checkoutId,
                )
                .separator()
                .customerInfo(order.customer)
                .separator()
                .json('Custom Fields', order.customFieldData)
                .separator()
                .json('Metadata', order.metadata)

            return {
                title: '💰🆕 Order Created',
                description: description
                    .separator()
                    .hashtags(['order', 'created'])
                    .build(),
                silent: true,
            }
        },

        ['order.paid']: (order) => {
            const description = new AlertDescriptionBuilder(config)

            orderProduct(order, description)

            description
                .separator()
                .moneyField(
                    '🧾 Subtotal',
                    order.subtotalAmount,
                    order.subtotalAmount !== order.totalAmount,
                    undefined,
                    order.currency,
                )
                .discountInfo(
                    order.discount,
                    order.discountAmount,
                    order.currency,
                )
                .moneyField(
                    '🏛️ Tax',
                    order.taxAmount,
                    order.taxAmount > 0,
                    undefined,
                    order.currency,
                )
                .moneyField(
                    '💰 Total',
                    order.totalAmount,
                    true,
                    undefined,
                    order.currency,
                )
                .separator()
                .field('Billing reason', order.billingReason.toUpperCase())
                .field('Invoice number', order.invoiceNumber, 'code')
                .separator()
                .link('View Order', getOrderLink(config, order.id))
                .separator()

            // Subscription
            if (order.subscriptionId) {
                description.link(
                    'View Subscription',
                    getSubscriptionLink(config, order.subscriptionId),
                )
            }

            description
                .link(
                    'View Checkout',
                    getCheckoutLink(config, order.checkoutId!),
                    !!order.checkoutId,
                )
                .separator()
                .customerInfo(order.customer)

            return {
                title: '💰✅ Order Paid',
                description: description
                    .separator()
                    .hashtags(['order', 'paid'])
                    .build(),
                silent: false,
            }
        },

        ['order.refunded']: (order) => {
            const description = new AlertDescriptionBuilder(config)

            orderProduct(order, description)

            description
                .separator()
                .field('Status', order.status.toUpperCase(), 'code')
                .separator()
                .moneyField(
                    '🔙 Refunded Amount',
                    order.refundedAmount,
                    true,
                    undefined,
                    order.currency,
                )
                .moneyField(
                    '🏛️ Refunded Tax',
                    order.refundedTaxAmount,
                    order.refundedTaxAmount !== 0,
                    undefined,
                    order.currency,
                )
                .moneyField(
                    '💳 Platform Fee',
                    order.platformFeeAmount,
                    order.platformFeeAmount !== 0,
                    undefined,
                    order.platformFeeCurrency ?? order.currency,
                )
                .separator()
                .custom('Original amount:')
                .moneyField(
                    '🧾 Subtotal',
                    order.subtotalAmount,
                    order.subtotalAmount !== order.totalAmount,
                    undefined,
                    order.currency,
                )
                .discountInfo(
                    order.discount,
                    order.discountAmount,
                    order.currency,
                )
                .moneyField(
                    '🏛️ Tax',
                    order.taxAmount,
                    order.taxAmount > 0,
                    undefined,
                    order.currency,
                )
                .moneyField(
                    '💰 Total',
                    order.totalAmount,
                    true,
                    undefined,
                    order.currency,
                )
                .separator()
                .link('View Order', getOrderLink(config, order.id))
                .separator()

            if (order.subscriptionId) {
                description.link(
                    'View Subscription',
                    getSubscriptionLink(config, order.subscriptionId),
                )
            }

            description
                .link(
                    'View Checkout',
                    getCheckoutLink(config, order.checkoutId!),
                    !!order.checkoutId,
                )
                .separator()
                .customerInfo(order.customer)

            return {
                title: '💰🔙 Order Refunded',
                description: description
                    .separator()
                    .hashtags(['order', 'refunded'])
                    .build(),
                silent: true,
            }
        },

        ['order.updated']: (order) => {
            const description = new AlertDescriptionBuilder(config)

            orderProduct(order, description)

            description
                .separator()
                .field('Status', order.status.toUpperCase())
                .dateField('Created on', order.createdAt)
                .dateField('🔁 Updated on', order.modifiedAt)
                .moneyField(
                    '🔙 Refunded Amount',
                    order.refundedAmount,
                    order.refundedAmount !== 0,
                    undefined,
                    order.currency,
                )
                .moneyField(
                    '🏛️ Refunded Tax',
                    order.refundedTaxAmount,
                    order.refundedTaxAmount !== 0,
                    undefined,
                    order.currency,
                )
                .separator()
                .moneyField(
                    '🧾 Subtotal',
                    order.subtotalAmount,
                    order.subtotalAmount !== order.totalAmount,
                    undefined,
                    order.currency,
                )
                .discountInfo(
                    order.discount,
                    order.discountAmount,
                    order.currency,
                )
                .moneyField(
                    '🏛️ Tax',
                    order.taxAmount,
                    order.taxAmount > 0,
                    undefined,
                    order.currency,
                )
                .moneyField(
                    '💰 Total',
                    order.totalAmount,
                    true,
                    undefined,
                    order.currency,
                )
                .separator()
                .link('View Order', getOrderLink(config, order.id))
                .separator()

            if (order.subscriptionId) {
                description.link(
                    'View Subscription',
                    getSubscriptionLink(config, order.subscriptionId),
                )
            }

            description
                .link(
                    'View Checkout',
                    getCheckoutLink(config, order.checkoutId!),
                    !!order.checkoutId,
                )
                .separator()
                .customerInfo(order.customer)

            return {
                title: '💰🔁 Order Updated',
                description: description
                    .separator()
                    .hashtags(['order', 'updated'])
                    .build(),
                silent: true,
            }
        },

        ['refund.created']: (refund) => {
            const description = new AlertDescriptionBuilder(config)
                .field('Status', refund.status.toUpperCase())
                .field('Reason', refund.reason.toUpperCase())
                .dateField('Created on', refund.createdAt)
                .separator()
                .moneyField(
                    '🔙 Refund Amount',
                    refund.amount,
                    true,
                    undefined,
                    refund.currency,
                )
                .moneyField(
                    '🏛️ Tax Refund',
                    refund.taxAmount,
                    refund.taxAmount > 0,
                    undefined,
                    refund.currency,
                )

            if (refund.dispute) {
                description
                    .separator()
                    .field('⚠️ Dispute', refund.dispute.status.toUpperCase())
            }

            description
                .separator()
                .link('View Order', getOrderLink(config, refund.orderId))

            if (refund.subscriptionId) {
                description.link(
                    'View Subscription',
                    getSubscriptionLink(config, refund.subscriptionId),
                )
            }

            description.link(
                'View Customer',
                getCustomerLink(config, refund.customerId),
            )

            return {
                title: '🔙🆕 Refund Created',
                description: description
                    .separator()
                    .hashtags(['refund', 'created'])
                    .build(),
                silent: true,
            }
        },

        ['refund.updated']: (refund) => {
            const description = new AlertDescriptionBuilder(config)
                .field('Status', refund.status.toUpperCase())
                .field('Reason', refund.reason.toUpperCase())
                .dateField('Created on', refund.createdAt)
                .dateField('🔁 Updated on', refund.modifiedAt)
                .separator()
                .moneyField(
                    '🔙 Refund Amount',
                    refund.amount,
                    true,
                    undefined,
                    refund.currency,
                )
                .moneyField(
                    '🏛️ Tax Refund',
                    refund.taxAmount,
                    refund.taxAmount > 0,
                    undefined,
                    refund.currency,
                )
                .separator()
                .link('View Order', getOrderLink(config, refund.orderId))

            if (refund.subscriptionId) {
                description.link(
                    'View Subscription',
                    getSubscriptionLink(config, refund.subscriptionId),
                )
            }

            description.link(
                'View Customer',
                getCustomerLink(config, refund.customerId),
            )

            return {
                title: '🔙🔁 Refund Updated',
                description: description
                    .separator()
                    .hashtags(['refund', 'updated'])
                    .build(),
                silent: true,
            }
        },

        ['customer.created']: (customer) => {
            const description = new AlertDescriptionBuilder(config)
                .field('ID', customer.id, 'code')
                .field('Name', customer.name || customer.email)
                .field('Email', customer.email)
                .dateField('Created on', customer.createdAt)

            if (customer.externalId) {
                description
                    .separator()
                    .field('External ID', customer.externalId)
            }

            description
                .separator()
                .json('Metadata', customer.metadata)
                .separator()
                .link('View Customer', getCustomerLink(config, customer.id))

            return {
                title: '👤🆕 Customer Created',
                description: description
                    .separator()
                    .hashtags(['customer', 'created'])
                    .build(),
                silent: true,
            }
        },

        ['customer.updated']: (customer) => {
            const description = new AlertDescriptionBuilder(config)
                .field('ID', customer.id, 'code')
                .field('External ID', customer.externalId)
                .field('Name', customer.name || customer.email)
                .field('Email', customer.email)
                .separator()
                .dateField('Updated at', customer.modifiedAt)
                .separator()
                .json('Metadata', customer.metadata)
                .separator()
                .link('View Customer', getCustomerLink(config, customer.id))

            return {
                title: '👤🔁 Customer Updated',
                description: description
                    .separator()
                    .hashtags(['customer', 'updated'])
                    .build(),
                silent: true,
            }
        },

        ['customer.deleted']: (customer) => {
            const description = new AlertDescriptionBuilder(config)
                .field('ID', customer.id, 'code')
                .field('Name', customer.name || customer.email)
                .field('Email', customer.email)
                .dateField('❌ Deleted at', customer.deletedAt)

            return {
                title: '👤❌ Customer Deleted',
                description: description
                    .separator()
                    .hashtags(['customer', 'deleted'])
                    .build(),
                silent: true,
            }
        },
    }
}

function checkoutProducts(
    checkout: Checkout,
    description: AlertDescriptionBuilder,
): void {
    // `products` lists everything offered in the checkout; `product` is the one selected
    if (checkout.product) {
        description.productInfo(checkout.product, {
            prices: checkout.productPrice ? [checkout.productPrice] : undefined,
            currency: checkout.currency,
        })
    } else {
        description.productsInfo(checkout.products, {
            currency: checkout.currency,
        })
    }
}

function checkoutCustomer(
    checkout: Checkout,
    description: AlertDescriptionBuilder,
): void {
    // New customers only get a `customerId` once the checkout succeeds
    if (checkout.customerId || checkout.customerEmail) {
        description.separator().customerInfo({
            id: checkout.customerId,
            name: checkout.customerName,
            email: checkout.customerEmail,
            billingAddress: checkout.customerBillingAddress,
            metadata: checkout.customerMetadata,
        })
    }
}

function orderProduct(
    order: Order,
    description: AlertDescriptionBuilder,
): void {
    // `product` is null when the order isn't tied to a single product, e.g. when
    // the product was deleted. Fall back to Polar's own description of the order.
    if (order.product) {
        description.productInfo(order.product)
    } else {
        description.custom(order.description)
    }
}

function subscriptionInterval(subscription: Subscription) {
    return {
        interval: subscription.recurringInterval,
        count: subscription.recurringIntervalCount,
    }
}

function subscriptionSeats(
    subscription: Subscription,
    description: AlertDescriptionBuilder,
): void {
    // Only surface seat count once there's more than one seat purchased —
    // a single-seat subscription isn't meaningfully "team" billing.
    if (subscription.seats && subscription.seats > 1) {
        description.separator().field('👥 Seats', subscription.seats.toString())
    }
}

const DAY_MS = 24 * 60 * 60 * 1000

function subscriptionTrial(
    subscription: Subscription,
    description: AlertDescriptionBuilder,
    config: PolarAlertsConfig,
): void {
    if (
        subscription.status === 'trialing' &&
        subscription.trialStart &&
        subscription.trialEnd
    ) {
        const start = new Date(subscription.trialStart)
        const end = new Date(subscription.trialEnd)

        // Round to whole days so a trial ending a few seconds early isn't shown as "6 days"
        const days = Math.max(
            1,
            Math.round((end.getTime() - start.getTime()) / DAY_MS),
        )

        const duration = formatDuration(
            intervalToDuration({
                start,
                end: new Date(start.getTime() + days * DAY_MS),
            }),
            {
                zero: false,
                format: ['years', 'months', 'weeks', 'days'],
            },
        )

        description
            .separator()
            .field(
                '🎁 Trial',
                `${duration} (until ${formatDate(end, config.timeZone ?? 'UTC', 'date')})`,
            )
    }
}
