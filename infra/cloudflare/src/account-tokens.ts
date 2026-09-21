import type { ApiToken } from "alchemy/Cloudflare";

const accountTokens = {
  BillingRead: { permission: "Billing Read", slug: "billing-read" },
  FlagshipWrite: { permission: { id: "521a41dc78f94eaba5e643528846cb7b" }, slug: "flagship-write" },
  ObservabilityQuery: { permission: "Workers Observability Write", slug: "observability-query" },
} as const satisfies Readonly<
  Record<string, { permission: ApiToken.PermissionGroupRef; slug: string }>
>;

export { accountTokens };
