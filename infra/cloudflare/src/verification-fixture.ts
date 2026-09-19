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
  origins: {
    "internal-dashboard": "https://wiki.example.com",
    "service-admin": "https://admin.example.com",
    "service-member": "https://user.example.com",
  },
  otlp: { enabled: true, endpoint: "https://otlp.example.com" },
  otlpAuthorization: "Bearer stack-verification-not-a-real-token",
  prefix: "template-verify",
  zoneId: "b".repeat(HEX_ID_LENGTH),
};

const verificationEnvironment: Readonly<Record<string, string>> = {
  ALERT_EMAIL: verificationSettings.budget.recipients.join(","),
  BUDGET_JPY: String(verificationSettings.budget.budgetJpy),
  CLOUDFLARE_ACCOUNT_ID: verificationSettings.accountId,
  CLOUDFLARE_API_TOKEN: "stack-verification-not-a-real-token",
  CLOUDFLARE_ZONE_ID: verificationSettings.zoneId,
  TEMPLATE_SERVICE_ADMIN_ORIGIN: verificationSettings.origins["service-admin"],
  TEMPLATE_AUTH_SECRET: verificationAuthSecret,
  TEMPLATE_FIXED_COST_USD: String(verificationSettings.budget.fixedCostUsd),
  TEMPLATE_JPY_PER_USD: String(verificationSettings.budget.jpyPerUsd),
  TEMPLATE_MAIL_FROM: verificationSettings.mailFrom,
  TEMPLATE_OBSERVABILITY_SAMPLING: String(verificationSettings.observabilitySampling),
  TEMPLATE_OTLP_AUTHORIZATION: verificationSettings.otlpAuthorization,
  TEMPLATE_OTLP_ENABLED: String(verificationSettings.otlp.enabled),
  TEMPLATE_OTLP_ENDPOINT: verificationSettings.otlp.endpoint,
  TEMPLATE_PREFIX: verificationSettings.prefix,
  TEMPLATE_RESERVE_USD: String(verificationSettings.budget.reserveUsd),
  TEMPLATE_SERVICE_MEMBER_ORIGIN: verificationSettings.origins["service-member"],
  TEMPLATE_INTERNAL_DASHBOARD_ORIGIN: verificationSettings.origins["internal-dashboard"],
};

export { verificationAuthSecret, verificationEnvironment, verificationSettings };
