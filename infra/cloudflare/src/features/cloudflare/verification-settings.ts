import { deploymentKey } from "@repo/observability/deployment-keys";

const HEX_ID_LENGTH = 32;
const verificationAuthSecret = "verification-test-secret-0123456789abcdef";

const verificationSettings = {
  accountId: "a".repeat(HEX_ID_LENGTH),
  budget: {
    budgetJpy: 5000,
    recipients: ["billing@example.com"],
  },
  mailFrom: "mail@template-verify.example.com",
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
  [deploymentKey.alertEmail]: verificationSettings.budget.recipients.join(","),
  [deploymentKey.budgetJpy]: String(verificationSettings.budget.budgetJpy),
  [deploymentKey.cloudflareAccountId]: verificationSettings.accountId,
  [deploymentKey.cloudflareApiToken]: "stack-verification-not-a-real-token",
  [deploymentKey.cloudflareZoneId]: verificationSettings.zoneId,
  [deploymentKey.appDomain]: "example.com",
  [deploymentKey.authSecret]: verificationAuthSecret,
  [deploymentKey.mailFrom]: verificationSettings.mailFrom,
  [deploymentKey.otlpAuthorization]: verificationSettings.otlpAuthorization,
  [deploymentKey.otlpEnabled]: String(verificationSettings.otlp.enabled),
  [deploymentKey.otlpEndpoint]: verificationSettings.otlp.endpoint,
  [deploymentKey.prefix]: verificationSettings.prefix,
};

export { verificationAuthSecret, verificationEnvironment, verificationSettings };
