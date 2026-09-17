import * as pulumi from "@pulumi/pulumi";
import * as cloudflare from "@pulumi/cloudflare";
import { budgetWorkerArtifact } from "@template/budget-monitor/artifact";
import { errorWorkerArtifact } from "@template/error-monitor/artifact";
import { healthWorkerArtifact } from "@template/health-monitor/artifact";
import { parseSharedConfig, selectAccountPermission, validateAuthSecret } from "./config.ts";
import { deployMonitor } from "./worker.ts";

const config = new pulumi.Config();
const settings = parseSharedConfig(config.requireObject<unknown>("settings"));
export const authSecret = config.requireSecret("authSecret").apply(validateAuthSecret);
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
const alert = { from: settings.mailFrom, to: settings.budget.recipients };

const budget = await deployMonitor("budget", {
  accountId: settings.accountId,
  name: `${settings.prefix}-budget`,
  artifact: budgetWorkerArtifact,
  className: "BudgetMonitor",
  token: {
    name: `${settings.prefix}-billing-read`,
    binding: "BILLING_READ_TOKEN",
    permission: permissions.results.apply((groups) =>
      selectAccountPermission(groups, "Billing Read"),
    ),
  },
  alert,
  variables: {
    CLOUDFLARE_ACCOUNT_ID: settings.accountId,
    BUDGET_JPY: String(settings.budget.budgetJpy),
    JPY_PER_USD: String(settings.budget.jpyPerUsd),
    FIXED_COST_USD: String(settings.budget.fixedCostUsd),
    RESERVE_USD: String(settings.budget.reserveUsd),
  },
  cron: "17 */6 * * *",
});

const errors = await deployMonitor("error", {
  accountId: settings.accountId,
  name: `${settings.prefix}-errors`,
  artifact: errorWorkerArtifact,
  className: "ErrorMonitor",
  token: {
    name: `${settings.prefix}-observability-query`,
    binding: "OBSERVABILITY_TOKEN",
    permission: permissions.results.apply((groups) =>
      selectAccountPermission(groups, "Workers Observability Write"),
    ),
  },
  alert,
  variables: { CLOUDFLARE_ACCOUNT_ID: settings.accountId },
  cron: "*/5 * * * *",
});

const health = await deployMonitor("health", {
  accountId: settings.accountId,
  name: `${settings.prefix}-health`,
  artifact: healthWorkerArtifact,
  className: "HealthMonitor",
  alert,
  variables: {
    USER_ORIGIN: settings.origins.user,
    ADMIN_ORIGIN: settings.origins.admin,
    WIKI_ORIGIN: settings.origins.wiki,
  },
  cron: "37 * * * *",
});

export const databaseId = database.id;
export const applicationSettings = settings;
export const budgetWorkerName = budget.workerName;
export const budgetScheduleId = budget.scheduleId;
export const errorWorkerName = errors.workerName;
export const errorScheduleId = errors.scheduleId;
export const healthWorkerName = health.workerName;
export const healthScheduleId = health.scheduleId;
