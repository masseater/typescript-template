import { D1Database, getAccountApiTokenPermissionGroupsListOutput } from "@pulumi/cloudflare";
import { parseSharedConfig, selectAccountPermission, validateAuthSecret } from "./config.ts";
import type { AccountPermission } from "./config.ts";
import { Config } from "@pulumi/pulumi";
import type { Output } from "@pulumi/pulumi";
import { budgetWorkerArtifact } from "@template/budget-monitor/artifact";
import { deployMonitor } from "./worker.ts";
import { errorWorkerArtifact } from "@template/error-monitor/artifact";
import { healthWorkerArtifact } from "@template/health-monitor/artifact";

const config = new Config();
const settings = parseSharedConfig(config.requireObject<unknown>("settings"));
const authSecret = config.requireSecret("authSecret").apply(validateAuthSecret);
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
const alert = { from: settings.mailFrom, to: settings.budget.recipients };

type PermissionGroups = readonly Readonly<{
  id: string;
  name: string;
  scopes: readonly string[];
}>[];

function permission(name: AccountPermission): Output<string> {
  return permissions.results.apply((groups: PermissionGroups) =>
    selectAccountPermission(groups, name),
  );
}

const budget = await deployMonitor("budget", {
  accountId: settings.accountId,
  alert,
  artifact: budgetWorkerArtifact,
  className: "BudgetMonitor",
  cron: "17 */6 * * *",
  name: `${settings.prefix}-budget`,
  token: {
    binding: "BILLING_READ_TOKEN",
    name: `${settings.prefix}-billing-read`,
    permission: permission("Billing Read"),
  },
  variables: {
    BUDGET_JPY: String(settings.budget.budgetJpy),
    CLOUDFLARE_ACCOUNT_ID: settings.accountId,
    FIXED_COST_USD: String(settings.budget.fixedCostUsd),
    JPY_PER_USD: String(settings.budget.jpyPerUsd),
    RESERVE_USD: String(settings.budget.reserveUsd),
  },
});

const errors = await deployMonitor("error", {
  accountId: settings.accountId,
  alert,
  artifact: errorWorkerArtifact,
  className: "ErrorMonitor",
  cron: "*/5 * * * *",
  name: `${settings.prefix}-errors`,
  token: {
    binding: "OBSERVABILITY_TOKEN",
    name: `${settings.prefix}-observability-query`,
    permission: permission("Workers Observability Write"),
  },
  variables: { CLOUDFLARE_ACCOUNT_ID: settings.accountId },
});

const health = await deployMonitor("health", {
  accountId: settings.accountId,
  alert,
  artifact: healthWorkerArtifact,
  className: "HealthMonitor",
  cron: "37 * * * *",
  name: `${settings.prefix}-health`,
  variables: {
    ADMIN_ORIGIN: settings.origins.admin,
    USER_ORIGIN: settings.origins.user,
    WIKI_ORIGIN: settings.origins.wiki,
  },
});

const databaseId = database.id;
const applicationSettings = settings;
const budgetWorkerName = budget.workerName;
const budgetScheduleId = budget.scheduleId;
const errorWorkerName = errors.workerName;
const errorScheduleId = errors.scheduleId;
const healthWorkerName = health.workerName;
const healthScheduleId = health.scheduleId;

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
