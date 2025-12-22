import { PolarAlertsConfig } from './types';

export function getCountryFlag(countryCode: string): string {
    const code = countryCode.toUpperCase();
    const codePoints = code
        .split('')
        .map((char) => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
}

export function getCustomerLink(
    config: PolarAlertsConfig,
    customerId: string
): string {
    return polarDashboardLink(config, `customers/${customerId}`);
}

export function getProductLink(
    config: PolarAlertsConfig,
    productId: string
): string {
    return polarDashboardLink(config, `products/${productId}`);
}

export function getOrderLink(
    config: PolarAlertsConfig,
    orderId: string
): string {
    return polarDashboardLink(config, `sales/${orderId}`);
}

export function getSubscriptionLink(
    config: PolarAlertsConfig,
    subscriptionId: string
): string {
    return polarDashboardLink(config, `sales/subscriptions/${subscriptionId}`);
}

export function getCheckoutLink(
    config: PolarAlertsConfig,
    checkoutId: string
): string {
    return polarDashboardLink(config, `sales/checkouts/${checkoutId}`);
}

function polarDashboardLink(config: PolarAlertsConfig, path: string): string {
    if (config.polarServer === 'production') {
        return `https://polar.sh/dashboard/${config.polarOrganizationSlug}/${path}`;
    } else {
        return `https://sandbox.polar.sh/dashboard/${config.polarOrganizationSlug}/${path}`;
    }
}
