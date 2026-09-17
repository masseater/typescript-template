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
  selectReadPermission,
  validateAuthSecret,
  validateOtelHeaders,
} from "./config.ts";
import { budgetWorkerArtifact } from "@template/budget-monitor/artifact";
// oxlint-disable-next-line import/no-nodejs-modules
import { readFile } from "node:fs/promises";
import { workerObservability } from "./observability.ts";

const config = new Config();
const settings = parseSharedConfig(config.requireObject<unknown>("settings"));
const authSecret = config.requireSecret("authSecret").apply(validateAuthSecret);
const otelHeaders = (config.getSecret("otelHeaders") ?? secret("{}")).apply(validateOtelHeaders);
const budgetContent = await readFile(budgetWorkerArtifact);
if (budgetContent.length === 0) {
  throw new Error("budget_worker_artifact_empty");
}
const budgetContentSha256 = Buffer.from(
  await crypto.subtle.digest("SHA-256", budgetContent),
).toString("hex");
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
        resources: JSON.stringify({ [`com.cloudflare.api.account.${settings.accountId}`]: "*" }),
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
  compatibilityDate: "2026-09-16",
  compatibilityFlags: ["nodejs_compat"],
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
  versions: [{ percentage: 100, versionId: budgetVersion.id }],
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

const databaseId = database.id;
const applicationSettings = settings;
const budgetWorkerName = budgetWorker.name;
const budgetScheduleId = schedule.id;

export {
  applicationSettings,
  authSecret,
  budgetScheduleId,
  budgetWorkerName,
  databaseId,
  otelHeaders,
};
