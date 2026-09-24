import { accountTokenRef, monitorArtifact, monitorProgram } from "@repo/infra-cloudflare/monitor";
import { prefixedStack } from "@repo/infra-cloudflare/prefixed-stack";
import { errorMonitorEnv, errorMonitorWorker } from "@repo/monitor/workers";
import { Effect } from "effect";

export default prefixedStack(
  "error-monitor",
  monitorProgram("error", {
    artifact: monitorArtifact("error-monitor"),
    className: errorMonitorWorker.className,
    cron: errorMonitorWorker.cron,
    name: errorMonitorWorker.name,
    variables: Effect.fn("errorVariables")(function* errorVariables(config) {
      const token = yield* accountTokenRef("ObservabilityQuery");
      return {
        [errorMonitorEnv.accountId]: config.accountId,
        [errorMonitorEnv.observabilityToken]: token.value,
      };
    }),
  }),
);
