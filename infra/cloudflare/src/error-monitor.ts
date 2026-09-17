import { errorWorkerArtifact } from "@template/error-monitor/artifact";
import { Effect } from "effect";
import { consume, consumeSettings } from "./reference.ts";
import { deployMonitor } from "./worker.ts";

const errors = await Effect.runPromise(
  Effect.gen(function* () {
    const { settings } = yield* consumeSettings("error-monitor", "settings");
    const tokens = yield* consume("error-monitor", "tokens");
    return yield* deployMonitor("error", {
      accountId: settings.accountId,
      name: `${settings.prefix}-errors`,
      artifact: errorWorkerArtifact,
      className: "ErrorMonitor",
      token: { binding: "OBSERVABILITY_TOKEN", text: tokens.text("observabilityQueryToken") },
      alert: { from: settings.mailFrom, to: settings.budget.recipients },
      variables: { CLOUDFLARE_ACCOUNT_ID: settings.accountId },
      cron: "*/5 * * * *",
    });
  }),
);

export const workerName = errors.workerName;
export const scheduleId = errors.scheduleId;
