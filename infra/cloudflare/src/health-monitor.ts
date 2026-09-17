import { Effect } from "effect";
import { consumeSettings } from "./reference.ts";
import { deployMonitor } from "./worker.ts";
import { healthWorkerArtifact } from "@template/health-monitor/artifact";

const health = await Effect.runPromise(
  Effect.gen(function* health() {
    const { settings } = yield* consumeSettings("health-monitor", "settings");
    return yield* deployMonitor("health", {
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
  }),
);

const { scheduleId, workerName } = health;

export { scheduleId, workerName };
