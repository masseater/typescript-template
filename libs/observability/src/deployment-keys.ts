const deploymentKey = {
  alertEmail: "ALERT_EMAIL",
  appDomain: "TEMPLATE_APP_DOMAIN",
  authSecret: "TEMPLATE_AUTH_SECRET",
  budgetJpy: "BUDGET_JPY",
  cloudflareAccountId: "CLOUDFLARE_ACCOUNT_ID",
  cloudflareApiToken: "CLOUDFLARE_API_TOKEN",
  cloudflareZoneId: "CLOUDFLARE_ZONE_ID",
  fixedCostUsd: "TEMPLATE_FIXED_COST_USD",
  jpyPerUsd: "TEMPLATE_JPY_PER_USD",
  mailFrom: "TEMPLATE_MAIL_FROM",
  observabilitySampling: "TEMPLATE_OBSERVABILITY_SAMPLING",
  otlpAuthorization: "TEMPLATE_OTLP_AUTHORIZATION",
  otlpEnabled: "TEMPLATE_OTLP_ENABLED",
  otlpEndpoint: "TEMPLATE_OTLP_ENDPOINT",
  googleAnalyticsMeasurementId: "TEMPLATE_GOOGLE_ANALYTICS_MEASUREMENT_ID",
  prefix: "TEMPLATE_PREFIX",
  reserveUsd: "TEMPLATE_RESERVE_USD",
  stripePriceId: "TEMPLATE_STRIPE_PRICE_ID",
  stripeSecretKey: "TEMPLATE_STRIPE_SECRET_KEY",
  stripeWebhookSecret: "TEMPLATE_STRIPE_WEBHOOK_SECRET",
} as const;

const budgetKeys = [
  deploymentKey.budgetJpy,
  deploymentKey.fixedCostUsd,
  deploymentKey.jpyPerUsd,
  deploymentKey.reserveUsd,
] as const;

const deploymentKeys = [
  deploymentKey.alertEmail,
  deploymentKey.budgetJpy,
  deploymentKey.cloudflareAccountId,
  deploymentKey.cloudflareApiToken,
  deploymentKey.cloudflareZoneId,
  deploymentKey.appDomain,
  deploymentKey.authSecret,
  deploymentKey.mailFrom,
  deploymentKey.prefix,
  deploymentKey.stripePriceId,
  deploymentKey.stripeSecretKey,
  deploymentKey.stripeWebhookSecret,
] as const;

const optionalDeploymentKeys = [
  deploymentKey.googleAnalyticsMeasurementId,
  deploymentKey.otlpAuthorization,
  deploymentKey.otlpEnabled,
  deploymentKey.otlpEndpoint,
] as const;

const privateDeploymentKeys: readonly string[] = [
  ...deploymentKeys.filter((key) => !budgetKeys.some((budget) => budget === key)),
  ...optionalDeploymentKeys,
];

export { deploymentKey, deploymentKeys, optionalDeploymentKeys, privateDeploymentKeys };
