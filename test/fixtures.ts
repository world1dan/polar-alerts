import type { Checkout } from '@polar-sh/sdk/models/components/checkout.js'
import type { CheckoutProduct } from '@polar-sh/sdk/models/components/checkoutproduct.js'
import type { CustomerIndividual } from '@polar-sh/sdk/models/components/customerindividual.js'
import type { CustomerSeat } from '@polar-sh/sdk/models/components/customerseat.js'
import type { Order } from '@polar-sh/sdk/models/components/order.js'
import type { OrderCustomer } from '@polar-sh/sdk/models/components/ordercustomer.js'
import type { OrderProduct } from '@polar-sh/sdk/models/components/orderproduct.js'
import type { Product } from '@polar-sh/sdk/models/components/product.js'
import type { ProductPriceFixed } from '@polar-sh/sdk/models/components/productpricefixed.js'
import type { Refund } from '@polar-sh/sdk/models/components/refund.js'
import type { Subscription } from '@polar-sh/sdk/models/components/subscription.js'

import type { EventData, EventType, WebhookPayload } from '../src/types'

export const NOW = new Date('2026-10-01T12:00:00Z')

const ORG_ID = 'org_1'

export function payload<T extends EventType>(
    type: T,
    data: EventData<T>,
): Extract<WebhookPayload, { type: T }> {
    return { type, timestamp: NOW, data } as Extract<
        WebhookPayload,
        { type: T }
    >
}

export function fixedPrice(
    overrides: Partial<ProductPriceFixed> = {},
): ProductPriceFixed {
    return {
        createdAt: NOW,
        modifiedAt: null,
        id: 'price_eur',
        source: 'catalog',
        amountType: 'fixed',
        priceCurrency: 'eur',
        taxBehavior: null,
        isArchived: false,
        productId: 'prod_pro',
        priceAmount: 8550,
        ...overrides,
    }
}

/** Quarterly plan with an archived USD price listed first, then the live EUR price. */
export const product: Product = {
    id: 'prod_pro',
    createdAt: NOW,
    modifiedAt: null,
    trialInterval: null,
    trialIntervalCount: null,
    name: 'Pro Plan',
    description: null,
    visibility: 'public',
    recurringInterval: 'month',
    recurringIntervalCount: 3,
    isRecurring: true,
    isArchived: false,
    organizationId: ORG_ID,
    metadata: {},
    prices: [
        fixedPrice({
            id: 'price_usd_old',
            priceCurrency: 'usd',
            priceAmount: 1000,
            isArchived: true,
        }),
        fixedPrice(),
    ],
    benefits: [],
    medias: [],
    attachedCustomFields: [],
}

export const checkoutProduct: CheckoutProduct = {
    id: product.id,
    createdAt: NOW,
    modifiedAt: null,
    trialInterval: null,
    trialIntervalCount: null,
    name: product.name,
    description: null,
    visibility: 'public',
    recurringInterval: 'month',
    recurringIntervalCount: 3,
    isRecurring: true,
    isArchived: false,
    organizationId: ORG_ID,
    prices: product.prices,
    benefits: [],
    medias: [],
}

export const orderProduct: OrderProduct = {
    id: 'prod_ebook',
    createdAt: NOW,
    modifiedAt: null,
    trialInterval: null,
    trialIntervalCount: null,
    name: 'Ebook',
    description: null,
    visibility: 'public',
    recurringInterval: null,
    recurringIntervalCount: null,
    isRecurring: false,
    isArchived: false,
    organizationId: ORG_ID,
    metadata: {},
}

export const customer: CustomerIndividual = {
    id: 'cus_1',
    createdAt: new Date('2026-09-15T08:30:00Z'),
    modifiedAt: null,
    metadata: {
        deviceType: 'mobile',
        referrer: 'https://news.ycombinator.com/item?id=1',
    },
    externalId: 'user_42',
    email: 'jane_doe@example.com',
    emailVerified: true,
    type: 'individual',
    name: 'Jane Doe',
    billingAddress: { country: 'DE' },
    taxId: null,
    organizationId: ORG_ID,
    deletedAt: null,
    avatarUrl: 'https://example.com/avatar.png',
}

const orderCustomer: OrderCustomer = customer

export const subscription: Subscription = {
    createdAt: NOW,
    modifiedAt: null,
    id: 'sub_1',
    amount: 8550,
    currency: 'eur',
    recurringInterval: 'month',
    recurringIntervalCount: 3,
    status: 'trialing',
    currentPeriodStart: NOW,
    currentPeriodEnd: new Date('2026-10-15T12:00:00Z'),
    trialStart: NOW,
    // A few seconds short of 14 days, as can happen with real timestamps
    trialEnd: new Date('2026-10-15T11:59:57Z'),
    cancelAtPeriodEnd: false,
    canceledAt: null,
    startedAt: NOW,
    endsAt: null,
    endedAt: null,
    customerId: customer.id,
    productId: product.id,
    discountId: 'disc_forever',
    checkoutId: 'co_1',
    seats: 5,
    customerCancellationReason: null,
    customerCancellationComment: null,
    metadata: { plan: 'team' },
    customer,
    product,
    discount: {
        duration: 'forever',
        type: 'percentage',
        basisPoints: 1250,
        createdAt: NOW,
        modifiedAt: null,
        id: 'disc_forever',
        metadata: {},
        name: 'Early adopter',
        code: 'EARLY_BIRD',
        startsAt: null,
        endsAt: null,
        maxRedemptions: null,
        redemptionsCount: 1,
        organizationId: ORG_ID,
    },
    prices: [fixedPrice()],
    meters: [],
    pendingUpdate: null,
}

export const order: Order = {
    id: 'ord_1',
    createdAt: NOW,
    modifiedAt: null,
    status: 'paid',
    paid: true,
    subtotalAmount: 1550,
    discountAmount: 500,
    netAmount: 1050,
    taxAmount: 0,
    totalAmount: 1050,
    appliedBalanceAmount: 0,
    dueAmount: 0,
    refundedAmount: 0,
    refundedTaxAmount: 0,
    currency: 'usd',
    billingReason: 'purchase',
    billingName: 'Jane Doe',
    billingAddress: { country: 'DE' },
    invoiceNumber: 'INV-0001',
    isInvoiceGenerated: true,
    receiptNumber: null,
    customerId: customer.id,
    productId: orderProduct.id,
    discountId: 'disc_fixed',
    subscriptionId: null,
    checkoutId: 'co_1',
    metadata: { source: 'landing' },
    customFieldData: { company: 'Acme' },
    platformFeeAmount: 0,
    platformFeeCurrency: null,
    customer: orderCustomer,
    product: orderProduct,
    discount: {
        duration: 'once',
        type: 'fixed',
        amount: 500,
        currency: 'usd',
        amounts: { usd: 500, eur: 450 },
        createdAt: NOW,
        modifiedAt: null,
        id: 'disc_fixed',
        metadata: {},
        name: 'Launch',
        code: 'LAUNCH_5',
        startsAt: null,
        endsAt: null,
        maxRedemptions: null,
        redemptionsCount: 1,
        organizationId: ORG_ID,
    },
    subscription: null,
    items: [
        {
            createdAt: NOW,
            modifiedAt: null,
            id: 'item_1',
            label: 'Ebook',
            amount: 1550,
            taxAmount: 0,
            proration: false,
            productPriceId: 'price_ebook',
        },
    ],
    description: 'Ebook',
    refundableAmount: 1050,
    refundableTaxAmount: 0,
}

export const checkout: Checkout = {
    id: 'co_1',
    createdAt: NOW,
    modifiedAt: null,
    customFieldData: { company: 'Acme' },
    paymentProcessor: 'stripe',
    status: 'open',
    clientSecret: 'secret',
    url: 'https://polar.sh/checkout/secret',
    expiresAt: new Date('2026-10-01T13:00:00Z'),
    successUrl: 'https://example.com/success',
    returnUrl: null,
    embedOrigin: null,
    amount: 8550,
    discountAmount: 0,
    netAmount: 8550,
    taxAmount: null,
    taxBehavior: null,
    totalAmount: 8550,
    currency: 'eur',
    allowTrial: null,
    activeTrialInterval: null,
    activeTrialIntervalCount: null,
    trialEnd: null,
    organizationId: ORG_ID,
    productId: product.id,
    productPriceId: 'price_eur',
    discountId: null,
    allowDiscountCodes: true,
    requireBillingAddress: false,
    isDiscountApplicable: true,
    isFreeProductPrice: false,
    isPaymentRequired: true,
    isPaymentSetupRequired: false,
    isPaymentFormRequired: true,
    // New customers only get an ID once the checkout succeeds
    customerId: null,
    isBusinessCustomer: false,
    customerName: 'Jane Doe',
    customerEmail: 'jane_doe@example.com',
    customerIpAddress: null,
    customerBillingName: null,
    customerBillingAddress: { country: 'DE' },
    customerTaxId: null,
    paymentProcessorMetadata: {},
    billingAddressFields: {
        country: 'required',
        state: 'disabled',
        city: 'disabled',
        postalCode: 'disabled',
        line1: 'disabled',
        line2: 'disabled',
    },
    trialInterval: null,
    trialIntervalCount: null,
    metadata: { campaign: 'fall' },
    externalCustomerId: null,
    products: [
        { ...checkoutProduct, id: 'prod_basic', name: 'Basic Plan' },
        checkoutProduct,
    ],
    product: checkoutProduct,
    productPrice: fixedPrice(),
    prices: null,
    discount: null,
    subscriptionId: null,
    attachedCustomFields: null,
    customerMetadata: {
        deviceType: 'desktop',
        referrer: 'https://www.google.com/',
    },
}

export const refund: Refund = {
    createdAt: NOW,
    modifiedAt: new Date('2026-10-01T12:05:00Z'),
    id: 'ref_1',
    metadata: {},
    status: 'succeeded',
    reason: 'customer_request',
    amount: 1050,
    taxAmount: 0,
    currency: 'usd',
    organizationId: ORG_ID,
    orderId: order.id,
    subscriptionId: 'sub_1',
    customerId: customer.id,
    revokeBenefits: true,
    dispute: null,
}

export const seat: CustomerSeat = {
    createdAt: NOW,
    modifiedAt: null,
    id: 'seat_1',
    subscriptionId: subscription.id,
    status: 'pending',
    customerId: customer.id,
    email: 'bob_smith@example.com',
    invitationTokenExpiresAt: new Date('2026-10-08T12:00:00Z'),
    seatMetadata: { team: 'design' },
}

export const member = {
    id: 'mem_1',
    createdAt: NOW,
    modifiedAt: null,
    customerId: customer.id,
    email: 'bob_smith@example.com',
    name: 'Bob Smith',
    externalId: 'ext_42',
    role: 'member',
} as const

/** One representative payload per event that has an alert template. */
export const payloads: WebhookPayload[] = [
    payload('checkout.created', checkout),
    payload('checkout.updated', {
        ...checkout,
        status: 'succeeded',
        customerId: customer.id,
    }),
    payload('subscription.created', subscription),
    payload('subscription.past_due', {
        ...subscription,
        status: 'past_due',
        seats: 1,
    }),
    payload('subscription.canceled', {
        ...subscription,
        status: 'active',
        cancelAtPeriodEnd: true,
        canceledAt: NOW,
        endsAt: subscription.currentPeriodEnd,
        customerCancellationReason: 'too_expensive',
        customerCancellationComment: 'Need a <cheaper> plan & fewer seats',
    }),
    payload('subscription.uncanceled', { ...subscription, status: 'active' }),
    payload('subscription.revoked', {
        ...subscription,
        status: 'canceled',
        endsAt: NOW,
        endedAt: NOW,
    }),
    payload('order.created', order),
    payload('order.paid', {
        ...order,
        billingReason: 'subscription_cycle',
        subscriptionId: subscription.id,
        discount: null,
        discountAmount: 0,
        subtotalAmount: 1050,
    }),
    payload('order.refunded', {
        ...order,
        status: 'partially_refunded',
        refundedAmount: 500,
        platformFeeAmount: 85,
    }),
    payload('order.updated', {
        ...order,
        modifiedAt: new Date('2026-10-02T09:00:00Z'),
    }),
    payload('refund.created', {
        ...refund,
        reason: 'dispute_prevention',
        dispute: {
            createdAt: NOW,
            modifiedAt: null,
            id: 'dsp_1',
            status: 'early_warning',
            resolved: false,
            closed: false,
            amount: 1050,
            taxAmount: 0,
            currency: 'usd',
            orderId: order.id,
            paymentId: 'pay_1',
        },
    }),
    payload('refund.updated', { ...refund, status: 'failed' }),
    payload('customer.created', customer),
    payload('customer.updated', {
        ...customer,
        modifiedAt: new Date('2026-10-02T09:00:00Z'),
    }),
    payload('customer.deleted', { ...customer, deletedAt: NOW }),
    payload('customer_seat.assigned', seat),
    payload('customer_seat.claimed', {
        ...seat,
        status: 'claimed',
        claimedAt: NOW,
        memberId: member.id,
        member,
    }),
    payload('customer_seat.revoked', {
        ...seat,
        status: 'revoked',
        revokedAt: NOW,
        memberId: member.id,
        member,
    }),
]
