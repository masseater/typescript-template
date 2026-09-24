const deploymentKey = {
  alertEmail: "ALERT_EMAIL",
  appDomain: "TEMPLATE_APP_DOMAIN",
  authSecret: "TEMPLATE_AUTH_SECRET",
  budgetJpy: "BUDGET_JPY",
  cloudflareAccountId: "CLOUDFLARE_ACCOUNT_ID",
  cloudflareApiToken: "CLOUDFLARE_API_TOKEN",
  cloudflareWorkersSubdomain: "CLOUDFLARE_WORKERS_SUBDOMAIN",
  cloudflareZoneId: "CLOUDFLARE_ZONE_ID",
  mailFrom: "TEMPLATE_MAIL_FROM",
  otlpAuthorization: "TEMPLATE_OTLP_AUTHORIZATION",
  otlpEnabled: "TEMPLATE_OTLP_ENABLED",
  otlpEndpoint: "TEMPLATE_OTLP_ENDPOINT",
  googleAnalyticsMeasurementId: "TEMPLATE_GOOGLE_ANALYTICS_MEASUREMENT_ID",
  prefix: "TEMPLATE_PREFIX",
  stripePriceId: "TEMPLATE_STRIPE_PRICE_ID",
  stripeSecretKey: "TEMPLATE_STRIPE_SECRET_KEY",
  stripeWebhookSecret: "TEMPLATE_STRIPE_WEBHOOK_SECRET",
} as const;
const deploymentKeys = [
  deploymentKey.alertEmail,
  deploymentKey.budgetJpy,
  deploymentKey.cloudflareAccountId,
  deploymentKey.cloudflareApiToken,
  deploymentKey.cloudflareWorkersSubdomain,
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
  ...deploymentKeys.filter(
    (settingName) =>
      settingName !== deploymentKey.budgetJpy &&
      settingName !== deploymentKey.cloudflareWorkersSubdomain,
  ),
  ...optionalDeploymentKeys,
];
export { deploymentKey, deploymentKeys, optionalDeploymentKeys, privateDeploymentKeys };
