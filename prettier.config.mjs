/** @type {import('prettier').Config & import('@ianvs/prettier-plugin-sort-imports').PrettierConfig} */
const config = {
    tabWidth: 4,
    semi: false,
    singleQuote: true,
    importOrder: [
        '^(react/(.*)$)|^(react$)',
        '^(next/(.*)$)|^(next$)',
        '',
        '<THIRD_PARTY_MODULES>',
        '',
        '^@/types/(.*)$',
        '^@/config/(.*)$',
        '^@/lib/(.*)$',
        '^@/helpers/(.*)$',
        '^@/utils/(.*)$',
        '^@/hooks/(.*)$',
        '^@/components/ui/(.*)$',
        '^@/components/(.*)$',
        '^@/styles/(.*)$',
        '^@/app/(.*)$',
        '',
        '^[./]',
    ],
    plugins: ['@ianvs/prettier-plugin-sort-imports'],
}

export default config
