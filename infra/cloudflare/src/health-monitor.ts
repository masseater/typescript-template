import { healthWorkerArtifact } from "@template/health-monitor/artifact";
import { consumeSettings } from "./reference.ts";
import { deployMonitor } from "./worker.ts";

const { settings } = await consumeSettings("health-monitor", "settings");
const health = await deployMonitor("health", {
  accountId: settings.accountId,
  name: `${settings.prefix}-health`,
  artifact: healthWorkerArtifact,
  className: "HealthMonitor",
  alert: { from: settings.mailFrom, to: settings.budget.recipients },
  variables: {
    USER_ORIGIN: settings.origins.user,
    ADMIN_ORIGIN: settings.origins.admin,
    WIKI_ORIGIN: settings.origins.wiki,
  },
  cron: "37 * * * *",
});

export const workerName = health.workerName;
export const scheduleId = health.scheduleId;
