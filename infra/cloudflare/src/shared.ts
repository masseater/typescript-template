import * as pulumi from "@pulumi/pulumi";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import * as cloudflare from "@pulumi/cloudflare";
import { workerCompatibility } from "@template/config/worker";
import { budgetWorkerArtifact } from "@template/budget-monitor/artifact";
import { errorWorkerArtifact } from "@template/error-monitor/artifact";
import { healthWorkerArtifact } from "@template/health-monitor/artifact";
import { Effect } from "effect";
import { workerObservability } from "./observability.ts";
import { fail, io } from "./artifacts.ts";
import {
  parseSharedConfig,
  selectObservabilityQueryPermission,
  selectReadPermission,
  validateAuthSecret,
} from "./config.ts";

const readWorkerArtifact = (
  filename: string,
  empty:
    | "budget_worker_artifact_empty"
    | "error_worker_artifact_empty"
    | "health_worker_artifact_empty",
) =>
  Effect.runPromise(
    io(() => readFile(filename)).pipe(
      Effect.flatMap((content) => (content.length === 0 ? fail(empty) : Effect.succeed(content))),
    ),
  );

const config = new pulumi.Config();
const settings = Effect.runSync(parseSharedConfig(config.requireObject<unknown>("settings")));
export const authSecret = config
  .requireSecret("authSecret")
  .apply((value) => Effect.runSync(validateAuthSecret(value)));
const budgetContent = await readWorkerArtifact(
  budgetWorkerArtifact,
  "budget_worker_artifact_empty",
);
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
        permissionGroups: [
          {
            id: permissions.results.apply((groups) => Effect.runSync(selectReadPermission(groups))),
          },
        ],
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
  compatibilityDate: workerCompatibility.date,
  compatibilityFlags: [...workerCompatibility.flags],
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
      allowedDestinationAddresses: [...settings.budget.recipients],
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

const errorContent = await readWorkerArtifact(errorWorkerArtifact, "error_worker_artifact_empty");
const observabilityToken = new cloudflare.AccountToken(
  "error-query-token",
  {
    accountId: settings.accountId,
    name: `${settings.prefix}-observability-query`,
    policies: [
      {
        effect: "allow",
        permissionGroups: [
          {
            id: permissions.results.apply((groups) =>
              Effect.runSync(selectObservabilityQueryPermission(groups)),
            ),
          },
        ],
        resources: JSON.stringify({ [`com.cloudflare.api.account.${settings.accountId}`]: "*" }),
      },
    ],
  },
  { additionalSecretOutputs: ["value"] },
);
const errorWorker = new cloudflare.Worker("error-worker", {
  accountId: settings.accountId,
  name: `${settings.prefix}-errors`,
  subdomain: { enabled: false, previewsEnabled: false },
  observability: workerObservability,
});
const errorVersion = new cloudflare.WorkerVersion("error-version", {
  accountId: settings.accountId,
  workerId: errorWorker.id,
  compatibilityDate: "2026-09-16",
  compatibilityFlags: ["nodejs_compat"],
  mainModule: "index.js",
  modules: [
    {
      name: "index.js",
      contentType: "application/javascript+module",
      contentFile: errorWorkerArtifact,
      contentSha256: createHash("sha256").update(errorContent).digest("hex"),
    },
  ],
  migrations: { newTag: "v1", newSqliteClasses: ["ErrorMonitor"] },
  bindings: [
    { type: "durable_object_namespace", name: "MONITOR", className: "ErrorMonitor" },
    {
      type: "send_email",
      name: "EMAIL",
      allowedSenderAddresses: [settings.mailFrom],
      allowedDestinationAddresses: [...settings.budget.recipients],
    },
    {
      type: "secret_text",
      name: "OBSERVABILITY_TOKEN",
      text: pulumi.secret(observabilityToken.value),
    },
    ...Object.entries({
      CLOUDFLARE_ACCOUNT_ID: settings.accountId,
      ALERT_FROM: settings.mailFrom,
      ALERT_TO: settings.budget.recipients.join(","),
    }).map(([name, text]) => ({ type: "plain_text", name, text })),
  ],
});
const errorDeployment = new cloudflare.WorkersDeployment("error-deployment", {
  accountId: settings.accountId,
  scriptName: errorWorker.name,
  strategy: "percentage",
  versions: [{ versionId: errorVersion.id, percentage: 100 }],
});
const errorSchedule = new cloudflare.WorkersCronTrigger(
  "error-schedule",
  {
    accountId: settings.accountId,
    scriptName: errorWorker.name,
    schedules: [{ cron: "*/5 * * * *" }],
  },
  { dependsOn: [errorDeployment] },
);

const healthContent = await readWorkerArtifact(
  healthWorkerArtifact,
  "health_worker_artifact_empty",
);
const healthWorker = new cloudflare.Worker("health-worker", {
  accountId: settings.accountId,
  name: `${settings.prefix}-health`,
  subdomain: { enabled: false, previewsEnabled: false },
  observability: workerObservability,
});
const healthVersion = new cloudflare.WorkerVersion("health-version", {
  accountId: settings.accountId,
  workerId: healthWorker.id,
  compatibilityDate: "2026-09-16",
  compatibilityFlags: ["nodejs_compat"],
  mainModule: "index.js",
  modules: [
    {
      name: "index.js",
      contentType: "application/javascript+module",
      contentFile: healthWorkerArtifact,
      contentSha256: createHash("sha256").update(healthContent).digest("hex"),
    },
  ],
  migrations: { newTag: "v1", newSqliteClasses: ["HealthMonitor"] },
  bindings: [
    { type: "durable_object_namespace", name: "MONITOR", className: "HealthMonitor" },
    {
      type: "send_email",
      name: "EMAIL",
      allowedSenderAddresses: [settings.mailFrom],
      allowedDestinationAddresses: [...settings.budget.recipients],
    },
    ...Object.entries({
      USER_ORIGIN: settings.userOrigin,
      ADMIN_ORIGIN: settings.adminOrigin,
      WIKI_ORIGIN: settings.wikiOrigin,
      ALERT_FROM: settings.mailFrom,
      ALERT_TO: settings.budget.recipients.join(","),
    }).map(([name, text]) => ({ type: "plain_text", name, text })),
  ],
});
const healthDeployment = new cloudflare.WorkersDeployment("health-deployment", {
  accountId: settings.accountId,
  scriptName: healthWorker.name,
  strategy: "percentage",
  versions: [{ versionId: healthVersion.id, percentage: 100 }],
});
const healthSchedule = new cloudflare.WorkersCronTrigger(
  "health-schedule",
  {
    accountId: settings.accountId,
    scriptName: healthWorker.name,
    schedules: [{ cron: "37 * * * *" }],
  },
  { dependsOn: [healthDeployment] },
);

export const databaseId = database.id;
export const applicationSettings = settings;
export const budgetWorkerName = budgetWorker.name;
export const budgetScheduleId = schedule.id;
export const errorWorkerName = errorWorker.name;
export const errorScheduleId = errorSchedule.id;
export const healthWorkerName = healthWorker.name;
export const healthScheduleId = healthSchedule.id;
