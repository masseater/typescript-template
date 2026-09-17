import { consume, consumeSettings } from "./reference.ts";
import { Effect } from "effect";
import { deployMonitor } from "./worker.ts";
import { errorWorkerArtifact } from "@template/error-monitor/artifact";

const errors = await Effect.runPromise(
  Effect.gen(function* errors() {
    const { settings } = yield* consumeSettings("error-monitor", "settings");
    const tokens = yield* consume("error-monitor", "tokens");
    return yield* deployMonitor("error", {
      accountId: settings.accountId,
      alert: { from: settings.mailFrom, to: settings.budget.recipients },
      artifact: errorWorkerArtifact,
      className: "ErrorMonitor",
      cron: "*/5 * * * *",
      name: `${settings.prefix}-errors`,
      token: { binding: "OBSERVABILITY_TOKEN", text: tokens.text("observabilityQueryToken") },
      variables: { CLOUDFLARE_ACCOUNT_ID: settings.accountId },
    });
  }),
);

const { scheduleId, workerName } = errors;

export { scheduleId, workerName };
