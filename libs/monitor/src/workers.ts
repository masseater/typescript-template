import { APPLICATION, type Application } from "@repo/config";
import { deploymentKey } from "@repo/observability/deployment-keys";

const budgetMonitorWorker = {
  className: "BudgetMonitor",
  cron: "17 */6 * * *",
  event: "budget",
  name: "budget",
} as const;

const budgetMonitorEnv = {
  accountId: deploymentKey.cloudflareAccountId,
  billingReadToken: "BILLING_READ_TOKEN",
  budgetJpy: deploymentKey.budgetJpy,
} as const;

const errorMonitorWorker = {
  className: "ErrorMonitor",
  cron: "*/5 * * * *",
  event: "error_monitor",
  name: "errors",
} as const;

const errorMonitorEnv = {
  accountId: deploymentKey.cloudflareAccountId,
  observabilityToken: "OBSERVABILITY_TOKEN",
} as const;

const healthMonitorWorker = {
  className: "HealthMonitor",
  cron: "37 * * * *",
  event: "health_monitor",
  name: "health",
} as const;

const healthOriginKey = {
  [APPLICATION.wiki]: "INTERNAL_DASHBOARD_ORIGIN",
  [APPLICATION.admin]: "SERVICE_ADMIN_ORIGIN",
  [APPLICATION.user]: "SERVICE_MEMBER_ORIGIN",
} as const satisfies Record<Application, string>;

export {
  budgetMonitorEnv,
  budgetMonitorWorker,
  errorMonitorEnv,
  errorMonitorWorker,
  healthMonitorWorker,
  healthOriginKey,
};
