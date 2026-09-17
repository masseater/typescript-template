import {
  AccountToken,
  D1Database,
  Worker,
  WorkerVersion,
  WorkersCronTrigger,
  WorkersDeployment,
  getAccountApiTokenPermissionGroupsListOutput,
} from "@pulumi/cloudflare";
import { Config, secret } from "@pulumi/pulumi";
import {
  parseSharedConfig,
  selectObservabilityQueryPermission,
  selectReadPermission,
  validateAuthSecret,
} from "./config.ts";
import { budgetWorkerArtifact } from "@template/budget-monitor/artifact";
import { deployHealthMonitor } from "./health-monitor.ts";
import { errorWorkerArtifact } from "@template/error-monitor/artifact";
// oxlint-disable-next-line import/no-nodejs-modules
import { readFile } from "node:fs/promises";
import { workerCompatibility } from "@template/config/worker";
import { workerObservability } from "./observability.ts";

const FULL_ROLLOUT_PERCENTAGE = 100;

async function artifactSha256(artifact: string, emptyError: string): Promise<string> {
  const content = await readFile(artifact);
  if (content.length === 0) {
    throw new Error(emptyError);
  }
  return Buffer.from(await crypto.subtle.digest("SHA-256", content)).toString("hex");
}

const config = new Config();
const settings = parseSharedConfig(config.requireObject<unknown>("settings"));
const authSecret = config.requireSecret("authSecret").apply(validateAuthSecret);
const budgetContentSha256 = await artifactSha256(
  budgetWorkerArtifact,
  "budget_worker_artifact_empty",
);
const errorContentSha256 = await artifactSha256(errorWorkerArtifact, "error_worker_artifact_empty");
const accountResources = JSON.stringify({
  [`com.cloudflare.api.account.${settings.accountId}`]: "*",
});
const database = new D1Database(
  "shared-db",
  {
    accountId: settings.accountId,
    name: `${settings.prefix}-db`,
  },
  { protect: true },
);
const permissions = getAccountApiTokenPermissionGroupsListOutput({
  accountId: settings.accountId,
});
const billingToken = new AccountToken(
  "budget-read-token",
  {
    accountId: settings.accountId,
    name: `${settings.prefix}-billing-read`,
    policies: [
      {
        effect: "allow",
        permissionGroups: [{ id: permissions.results.apply(selectReadPermission) }],
        resources: accountResources,
      },
    ],
  },
  { additionalSecretOutputs: ["value"] },
);
const budgetWorker = new Worker("budget-worker", {
  accountId: settings.accountId,
  name: `${settings.prefix}-budget`,
  observability: workerObservability,
  subdomain: { enabled: false, previewsEnabled: false },
});
const budgetVersion = new WorkerVersion("budget-version", {
  accountId: settings.accountId,
  bindings: [
    { className: "BudgetMonitor", name: "MONITOR", type: "durable_object_namespace" },
    {
      allowedDestinationAddresses: [...settings.budget.recipients],
      allowedSenderAddresses: [settings.mailFrom],
      name: "EMAIL",
      type: "send_email",
    },
    { name: "BILLING_READ_TOKEN", text: secret(billingToken.value), type: "secret_text" },
    ...Object.entries({
      ALERT_FROM: settings.mailFrom,
      ALERT_TO: settings.budget.recipients.join(","),
      BUDGET_JPY: String(settings.budget.budgetJpy),
      CLOUDFLARE_ACCOUNT_ID: settings.accountId,
      FIXED_COST_USD: String(settings.budget.fixedCostUsd),
      JPY_PER_USD: String(settings.budget.jpyPerUsd),
      RESERVE_USD: String(settings.budget.reserveUsd),
    }).map(([name, text]: readonly [string, string]) => ({ name, text, type: "plain_text" })),
  ],
  compatibilityDate: workerCompatibility.date,
  compatibilityFlags: [...workerCompatibility.flags],
  mainModule: "index.js",
  migrations: { newSqliteClasses: ["BudgetMonitor"], newTag: "v1" },
  modules: [
    {
      contentFile: budgetWorkerArtifact,
      contentSha256: budgetContentSha256,
      contentType: "application/javascript+module",
      name: "index.js",
    },
  ],
  workerId: budgetWorker.id,
});
const budgetDeployment = new WorkersDeployment("budget-deployment", {
  accountId: settings.accountId,
  scriptName: budgetWorker.name,
  strategy: "percentage",
  versions: [{ percentage: FULL_ROLLOUT_PERCENTAGE, versionId: budgetVersion.id }],
});
const schedule = new WorkersCronTrigger(
  "budget-schedule",
  {
    accountId: settings.accountId,
    schedules: [{ cron: "17 */6 * * *" }],
    scriptName: budgetWorker.name,
  },
  { dependsOn: [budgetDeployment] },
);

const observabilityToken = new AccountToken(
  "error-query-token",
  {
    accountId: settings.accountId,
    name: `${settings.prefix}-observability-query`,
    policies: [
      {
        effect: "allow",
        permissionGroups: [{ id: permissions.results.apply(selectObservabilityQueryPermission) }],
        resources: accountResources,
      },
    ],
  },
  { additionalSecretOutputs: ["value"] },
);
const errorWorker = new Worker("error-worker", {
  accountId: settings.accountId,
  name: `${settings.prefix}-errors`,
  observability: workerObservability,
  subdomain: { enabled: false, previewsEnabled: false },
});
const errorVersion = new WorkerVersion("error-version", {
  accountId: settings.accountId,
  bindings: [
    { className: "ErrorMonitor", name: "MONITOR", type: "durable_object_namespace" },
    {
      allowedDestinationAddresses: [...settings.budget.recipients],
      allowedSenderAddresses: [settings.mailFrom],
      name: "EMAIL",
      type: "send_email",
    },
    {
      name: "OBSERVABILITY_TOKEN",
      text: secret(observabilityToken.value),
      type: "secret_text",
    },
    ...Object.entries({
      ALERT_FROM: settings.mailFrom,
      ALERT_TO: settings.budget.recipients.join(","),
      CLOUDFLARE_ACCOUNT_ID: settings.accountId,
    }).map(([name, text]: readonly [string, string]) => ({ name, text, type: "plain_text" })),
  ],
  compatibilityDate: workerCompatibility.date,
  compatibilityFlags: [...workerCompatibility.flags],
  mainModule: "index.js",
  migrations: { newSqliteClasses: ["ErrorMonitor"], newTag: "v1" },
  modules: [
    {
      contentFile: errorWorkerArtifact,
      contentSha256: errorContentSha256,
      contentType: "application/javascript+module",
      name: "index.js",
    },
  ],
  workerId: errorWorker.id,
});
const errorDeployment = new WorkersDeployment("error-deployment", {
  accountId: settings.accountId,
  scriptName: errorWorker.name,
  strategy: "percentage",
  versions: [{ percentage: FULL_ROLLOUT_PERCENTAGE, versionId: errorVersion.id }],
});
const errorSchedule = new WorkersCronTrigger(
  "error-schedule",
  {
    accountId: settings.accountId,
    schedules: [{ cron: "*/5 * * * *" }],
    scriptName: errorWorker.name,
  },
  { dependsOn: [errorDeployment] },
);
const healthMonitor = await deployHealthMonitor(settings);

const databaseId = database.id;
const applicationSettings = settings;
const budgetWorkerName = budgetWorker.name;
const budgetScheduleId = schedule.id;
const errorWorkerName = errorWorker.name;
const errorScheduleId = errorSchedule.id;
const healthWorkerName = healthMonitor.workerName;
const healthScheduleId = healthMonitor.scheduleId;

export {
  applicationSettings,
  authSecret,
  budgetScheduleId,
  budgetWorkerName,
  databaseId,
  errorScheduleId,
  errorWorkerName,
  healthScheduleId,
  healthWorkerName,
};
