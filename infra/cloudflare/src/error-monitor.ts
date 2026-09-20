import { errorMonitorEnv, errorMonitorWorker } from "@repo/error-monitor/config";
import { Stack } from "alchemy";
import { Effect } from "effect";

import { monitorArtifact } from "./artifacts.ts";
import { monitorProgram } from "./monitor.ts";
import { stackName, stackOptions } from "./stacks.ts";
import { accountTokenRef } from "./tokens.ts";

const stack = Stack(
  stackName("error-monitor"),
  stackOptions,
  monitorProgram(errorMonitorWorker.name, {
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

export default stack;
