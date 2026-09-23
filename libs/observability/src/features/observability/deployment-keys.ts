const deploymentKey = {
  alertEmail: "ALERT_EMAIL",
  appDomain: "TEMPLATE_APP_DOMAIN",
  authSecret: "TEMPLATE_AUTH_SECRET",
  budgetJpy: "BUDGET_JPY",
  cloudflareAccountId: "CLOUDFLARE_ACCOUNT_ID",
  cloudflareApiToken: "CLOUDFLARE_API_TOKEN",
  cloudflareZoneId: "CLOUDFLARE_ZONE_ID",
  mailFrom: "TEMPLATE_MAIL_FROM",
  otlpAuthorization: "TEMPLATE_OTLP_AUTHORIZATION",
  otlpEnabled: "TEMPLATE_OTLP_ENABLED",
  otlpEndpoint: "TEMPLATE_OTLP_ENDPOINT",
  prefix: "TEMPLATE_PREFIX",
} as const;

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
] as const;

const optionalDeploymentKeys = [
  deploymentKey.otlpAuthorization,
  deploymentKey.otlpEnabled,
  deploymentKey.otlpEndpoint,
] as const;

const privateDeploymentKeys: readonly string[] = [
  ...deploymentKeys.filter((key) => key !== deploymentKey.budgetJpy),
  ...optionalDeploymentKeys,
];

export { deploymentKey, deploymentKeys, optionalDeploymentKeys, privateDeploymentKeys };
