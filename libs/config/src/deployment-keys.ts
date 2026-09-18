const budgetKeys = [
  "BUDGET_JPY",
  "TEMPLATE_FIXED_COST_USD",
  "TEMPLATE_JPY_PER_USD",
  "TEMPLATE_RESERVE_USD",
] as const;

const deploymentKeys = [
  "ALERT_EMAIL",
  "BUDGET_JPY",
  "CLOUDFLARE_ACCOUNT_ID",
  "CLOUDFLARE_API_TOKEN",
  "CLOUDFLARE_ZONE_ID",
  "TEMPLATE_ADMIN_ORIGIN",
  "TEMPLATE_AUTH_SECRET",
  "TEMPLATE_MAIL_FROM",
  "TEMPLATE_PREFIX",
  "TEMPLATE_USER_ORIGIN",
  "TEMPLATE_WIKI_ORIGIN",
] as const;

const privateDeploymentKeys: readonly string[] = deploymentKeys.filter(
  (key) => !budgetKeys.some((budget) => budget === key),
);

export { deploymentKeys, privateDeploymentKeys };
