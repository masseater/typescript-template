import { APPLICATION } from "@repo/config";
import { deploymentKey } from "@repo/observability/deployment-keys";

const HEX_ID_LENGTH = 32;
const verificationAuthSecret = "verification-test-secret-0123456789abcdef";

const verificationSettings = {
  accountId: "a".repeat(HEX_ID_LENGTH),
  budget: {
    budgetJpy: 5000,
    fixedCostUsd: 5,
    jpyPerUsd: 151,
    recipients: ["billing@example.com"],
    reserveUsd: 2,
  },
  mailFrom: "mail@template-verify.example.com",
  observabilitySampling: 0.5,
  googleAnalyticsMeasurementId: "G-VERIFYMEASUREMENT",
  origins: {
    "internal-dashboard": "https://template-verify-dashboard.example.com",
    "service-admin": "https://template-verify-admin.example.com",
    "service-member": "https://template-verify-member.example.com",
  },
  otlp: { enabled: true, endpoint: "https://otlp.example.com" },
  otlpAuthorization: "Bearer stack-verification-not-a-real-token",
  prefix: "template-verify",
  zoneId: "b".repeat(HEX_ID_LENGTH),
};

const verificationEnvironment: Readonly<Record<string, string>> = {
<<<<<<< HEAD
  [deploymentKey.alertEmail]: verificationSettings.budget.recipients.join(","),
  [deploymentKey.budgetJpy]: String(verificationSettings.budget.budgetJpy),
  [deploymentKey.cloudflareAccountId]: verificationSettings.accountId,
  [deploymentKey.cloudflareApiToken]: "stack-verification-not-a-real-token",
  [deploymentKey.cloudflareZoneId]: verificationSettings.zoneId,
  [deploymentKey.appDomain]: "example.com",
  [deploymentKey.authSecret]: verificationAuthSecret,
  [deploymentKey.fixedCostUsd]: String(verificationSettings.budget.fixedCostUsd),
  [deploymentKey.jpyPerUsd]: String(verificationSettings.budget.jpyPerUsd),
  [deploymentKey.mailFrom]: verificationSettings.mailFrom,
  [deploymentKey.observabilitySampling]: String(verificationSettings.observabilitySampling),
  [deploymentKey.otlpAuthorization]: verificationSettings.otlpAuthorization,
  [deploymentKey.otlpEnabled]: String(verificationSettings.otlp.enabled),
  [deploymentKey.otlpEndpoint]: verificationSettings.otlp.endpoint,
  [deploymentKey.prefix]: verificationSettings.prefix,
  [deploymentKey.reserveUsd]: String(verificationSettings.budget.reserveUsd),
=======
  ALERT_EMAIL: verificationSettings.budget.recipients.join(","),
  BUDGET_JPY: String(verificationSettings.budget.budgetJpy),
  CLOUDFLARE_ACCOUNT_ID: verificationSettings.accountId,
  CLOUDFLARE_API_TOKEN: "stack-verification-not-a-real-token",
  CLOUDFLARE_ZONE_ID: verificationSettings.zoneId,
  TEMPLATE_APP_DOMAIN: "example.com",
  TEMPLATE_AUTH_SECRET: verificationAuthSecret,
  TEMPLATE_FIXED_COST_USD: String(verificationSettings.budget.fixedCostUsd),
  TEMPLATE_GOOGLE_ANALYTICS_MEASUREMENT_ID: verificationSettings.googleAnalyticsMeasurementId,
  TEMPLATE_JPY_PER_USD: String(verificationSettings.budget.jpyPerUsd),
  TEMPLATE_MAIL_FROM: verificationSettings.mailFrom,
  TEMPLATE_OBSERVABILITY_SAMPLING: String(verificationSettings.observabilitySampling),
  TEMPLATE_OTLP_AUTHORIZATION: verificationSettings.otlpAuthorization,
  TEMPLATE_OTLP_ENABLED: String(verificationSettings.otlp.enabled),
  TEMPLATE_OTLP_ENDPOINT: verificationSettings.otlp.endpoint,
  TEMPLATE_PREFIX: verificationSettings.prefix,
  TEMPLATE_RESERVE_USD: String(verificationSettings.budget.reserveUsd),
>>>>>>> 71ec8b05 (Add optional Google Analytics measurement ID to config and Cloudflare stacks)
};

export { verificationAuthSecret, verificationEnvironment, verificationSettings };
