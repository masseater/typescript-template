import { consume, consumeSettings } from "./reference.ts";
import { deployMonitor } from "./worker.ts";
import { errorWorkerArtifact } from "@template/error-monitor/artifact";

const { settings } = await consumeSettings("error-monitor", "settings");
const tokens = consume("error-monitor", "tokens");
const errors = await deployMonitor("error", {
  accountId: settings.accountId,
  alert: { from: settings.mailFrom, to: settings.budget.recipients },
  artifact: errorWorkerArtifact,
  className: "ErrorMonitor",
  cron: "*/5 * * * *",
  name: `${settings.prefix}-errors`,
  token: { binding: "OBSERVABILITY_TOKEN", text: tokens.text("observabilityQueryToken") },
  variables: { CLOUDFLARE_ACCOUNT_ID: settings.accountId },
});

const { scheduleId, workerName } = errors;

export { scheduleId, workerName };
