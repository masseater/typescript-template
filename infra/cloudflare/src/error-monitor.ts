import { errorWorkerArtifact } from "@template/error-monitor/artifact";
import { consume, consumeSettings } from "./reference.ts";
import { deployMonitor } from "./worker.ts";

const { settings } = await consumeSettings("error-monitor", "settings");
const tokens = consume("error-monitor", "tokens");
const errors = await deployMonitor("error", {
  accountId: settings.accountId,
  name: `${settings.prefix}-errors`,
  artifact: errorWorkerArtifact,
  className: "ErrorMonitor",
  token: { binding: "OBSERVABILITY_TOKEN", text: tokens.text("observabilityQueryToken") },
  alert: { from: settings.mailFrom, to: settings.budget.recipients },
  variables: { CLOUDFLARE_ACCOUNT_ID: settings.accountId },
  cron: "*/5 * * * *",
});

export const workerName = errors.workerName;
export const scheduleId = errors.scheduleId;
