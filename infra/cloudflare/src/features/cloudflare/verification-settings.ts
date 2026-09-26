import { deploymentKey } from "@repo/observability/deployment-keys";

const HEX_ID_LENGTH = 32;
const pemLabel = "PRIVATE KEY";
const verificationAuthSecret = "verification-test-secret-0123456789abcdef";

const verificationSettings = {
  accountId: "a".repeat(HEX_ID_LENGTH),
  budget: {
    budgetJpy: 5000,
    recipients: ["billing@example.com"],
  },
  mailFrom: "mail@template-verify.example.com",
  googleAnalyticsMeasurementId: "G-VERIFYMEASUREMENT",
  origins: {
    "internal-dashboard": "https://template-verify-dashboard.example.com",
    "service-admin": "https://template-verify-admin.example.com",
    "service-member": "https://template-verify-member.example.com",
  },
  otlp: { endpoint: "https://otlp.example.com" },
  otlpAuthorization: "Bearer stack-verification-not-a-real-token",
  prefix: "template-verify",
  stripeApiKey: "sk_test_stackVerificationNotAReal",
  wikiPublish: {
    appId: "424242",
    privateKey: `-----BEGIN ${pemLabel}-----\nstack-verification-not-a-real-key\n-----END ${pemLabel}-----\n`,
    repository: "template-verify/wiki",
  },
  zoneId: "b".repeat(HEX_ID_LENGTH),
};

const verificationEnvironment: Readonly<Record<string, string>> = {
  [deploymentKey.alertEmail]: verificationSettings.budget.recipients.join(","),
  [deploymentKey.budgetJpy]: String(verificationSettings.budget.budgetJpy),
  [deploymentKey.cloudflareAccountId]: verificationSettings.accountId,
  [deploymentKey.cloudflareApiToken]: "stack-verification-not-a-real-token",
  [deploymentKey.cloudflareWorkersSubdomain]: "verify-workers",
  [deploymentKey.cloudflareZoneId]: verificationSettings.zoneId,
  [deploymentKey.appDomain]: "example.com",
  [deploymentKey.authSecret]: verificationAuthSecret,
  [deploymentKey.googleAnalyticsMeasurementId]: verificationSettings.googleAnalyticsMeasurementId,
  [deploymentKey.mailFrom]: verificationSettings.mailFrom,
  [deploymentKey.otlpAuthorization]: verificationSettings.otlpAuthorization,
  [deploymentKey.otlpEndpoint]: verificationSettings.otlp.endpoint,
  [deploymentKey.prefix]: verificationSettings.prefix,
  [deploymentKey.stripeApiKey]: verificationSettings.stripeApiKey,
  [deploymentKey.wikiPublishAppId]: verificationSettings.wikiPublish.appId,
  [deploymentKey.wikiPublishPrivateKey]: verificationSettings.wikiPublish.privateKey,
  [deploymentKey.wikiPublishRepository]: verificationSettings.wikiPublish.repository,
};

export { verificationAuthSecret, verificationEnvironment, verificationSettings };
