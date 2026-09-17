import { consumeSettings } from "./reference.ts";
import { deployMonitor } from "./worker.ts";
import { healthWorkerArtifact } from "@template/health-monitor/artifact";

const { settings } = await consumeSettings("health-monitor", "settings");
const health = await deployMonitor("health", {
  accountId: settings.accountId,
  alert: { from: settings.mailFrom, to: settings.budget.recipients },
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

const { scheduleId, workerName } = health;

export { scheduleId, workerName };
