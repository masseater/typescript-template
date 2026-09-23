import { accountTokenRef, monitorArtifact, monitorProgram } from "@repo/infra-cloudflare/monitor";
import { stackName, stackOptions } from "@repo/infra-cloudflare/stacks";
import { errorMonitorEnv, errorMonitorWorker } from "@repo/monitor/workers";
import { Stack } from "alchemy";
import { Effect } from "effect";

export default Stack(
  stackName("error-monitor"),
  stackOptions,
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
