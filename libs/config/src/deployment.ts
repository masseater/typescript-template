// oxlint-disable-next-line import/no-nodejs-modules
import { homedir } from "node:os";
// oxlint-disable-next-line import/no-nodejs-modules
import path from "node:path";

const ENVIRONMENT_FILE_VARIABLE = "TEMPLATE_CLOUDFLARE_ENV_FILE";
const ENVIRONMENT_FILE_NAME = "cloudflare.env";

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

const optionalDeploymentKeys = ["TEMPLATE_OTLP_AUTHORIZATION", "TEMPLATE_OTLP_ENDPOINT"] as const;

const privateDeploymentKeys: readonly string[] = [
  ...deploymentKeys.filter((key) => !budgetKeys.some((budget) => budget === key)),
  ...optionalDeploymentKeys,
];

function configurationHome(project: string): string {
  // oxlint-disable-next-line node/no-process-env
  const base = process.env["XDG_CONFIG_HOME"];
  return path.join(
    base === undefined || base === "" ? path.join(homedir(), ".config") : base,
    project,
  );
}

function secretsFile(project: string): string {
  // oxlint-disable-next-line node/no-process-env
  const configured = process.env[ENVIRONMENT_FILE_VARIABLE];
  return configured === undefined || configured === ""
    ? path.join(configurationHome(project), ENVIRONMENT_FILE_NAME)
    : path.resolve(configured);
}

export { deploymentKeys, privateDeploymentKeys, secretsFile };
