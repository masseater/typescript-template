import * as pulumi from "@pulumi/pulumi";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import * as cloudflare from "@pulumi/cloudflare";
import { budgetWorkerArtifact } from "@template/budget-monitor/artifact";
import { workerObservability } from "./observability.ts";
import { parseSharedConfig, selectReadPermission, validateAuthSecret } from "./config.ts";

const config = new pulumi.Config();
const settings = parseSharedConfig(config.requireObject<unknown>("settings"));
export const authSecret = config.requireSecret("authSecret").apply(validateAuthSecret);
const budgetContent = await readFile(budgetWorkerArtifact);
if (budgetContent.length === 0) throw new Error("budget_worker_artifact_empty");
const budgetContentSha256 = createHash("sha256").update(budgetContent).digest("hex");
const database = new cloudflare.D1Database(
  "shared-db",
  {
    accountId: settings.accountId,
    name: `${settings.prefix}-db`,
  },
  { protect: true },
);
const permissions = cloudflare.getAccountApiTokenPermissionGroupsListOutput({
  accountId: settings.accountId,
});
const billingToken = new cloudflare.AccountToken(
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
const budgetWorker = new cloudflare.Worker("budget-worker", {
  accountId: settings.accountId,
  name: `${settings.prefix}-budget`,
  subdomain: { enabled: false, previewsEnabled: false },
  observability: workerObservability,
});
const budgetVersion = new cloudflare.WorkerVersion("budget-version", {
  accountId: settings.accountId,
  workerId: budgetWorker.id,
  compatibilityDate: "2026-09-16",
  compatibilityFlags: ["nodejs_compat"],
  mainModule: "index.js",
  modules: [
    {
      name: "index.js",
      contentType: "application/javascript+module",
      contentFile: budgetWorkerArtifact,
      contentSha256: budgetContentSha256,
    },
  ],
  migrations: { newTag: "v1", newSqliteClasses: ["BudgetMonitor"] },
  bindings: [
    { type: "durable_object_namespace", name: "MONITOR", className: "BudgetMonitor" },
    {
      type: "send_email",
      name: "EMAIL",
      allowedSenderAddresses: [settings.mailFrom],
      allowedDestinationAddresses: settings.budget.recipients,
    },
    { type: "secret_text", name: "BILLING_READ_TOKEN", text: pulumi.secret(billingToken.value) },
    ...Object.entries({
      CLOUDFLARE_ACCOUNT_ID: settings.accountId,
      BUDGET_JPY: String(settings.budget.budgetJpy),
      JPY_PER_USD: String(settings.budget.jpyPerUsd),
      FIXED_COST_USD: String(settings.budget.fixedCostUsd),
      RESERVE_USD: String(settings.budget.reserveUsd),
      ALERT_FROM: settings.mailFrom,
      ALERT_TO: settings.budget.recipients.join(","),
    }).map(([name, text]) => ({ type: "plain_text", name, text })),
  ],
});
const budgetDeployment = new cloudflare.WorkersDeployment("budget-deployment", {
  accountId: settings.accountId,
  scriptName: budgetWorker.name,
  strategy: "percentage",
  versions: [{ versionId: budgetVersion.id, percentage: 100 }],
});
const schedule = new cloudflare.WorkersCronTrigger(
  "budget-schedule",
  {
    accountId: settings.accountId,
    scriptName: budgetWorker.name,
    schedules: [{ cron: "17 */6 * * *" }],
  },
  { dependsOn: [budgetDeployment] },
);

export const databaseId = database.id;
export const applicationSettings = settings;
export const budgetWorkerName = budgetWorker.name;
export const budgetScheduleId = schedule.id;
