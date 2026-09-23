import { APPLICATION } from "@repo/config";
import { monitorArtifact, monitorProgram } from "@repo/infra-cloudflare/monitor";
import { stackName, stackOptions } from "@repo/infra-cloudflare/stacks";
import { healthMonitorWorker, healthOriginKey } from "@repo/monitor/workers";
import { Stack } from "alchemy";
import { Effect } from "effect";

import type { SharedConfig } from "@repo/infra-cloudflare/monitor";

export default Stack(
  stackName("health-monitor"),
  stackOptions,
  monitorProgram("health", {
    artifact: monitorArtifact("health-monitor"),
    className: healthMonitorWorker.className,
    cron: healthMonitorWorker.cron,
    name: healthMonitorWorker.name,
    variables: (config: SharedConfig) =>
      Effect.succeed({
        [healthOriginKey[APPLICATION.admin]]: config.origins[APPLICATION.admin],
        [healthOriginKey[APPLICATION.user]]: config.origins[APPLICATION.user],
        [healthOriginKey[APPLICATION.wiki]]: config.origins[APPLICATION.wiki],
      }),
  }),
);
