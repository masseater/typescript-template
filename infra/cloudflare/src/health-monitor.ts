import { APPLICATION } from "@repo/config";
import { healthMonitorWorker, healthOriginKey } from "@repo/health-monitor/config";
import { Stack } from "alchemy";
import { Effect } from "effect";

import { monitorArtifact } from "./artifacts.ts";
import { monitorProgram } from "./monitor.ts";
import { stackName, stackOptions } from "./stacks.ts";

import type { SharedConfig } from "./config.ts";

const stack = Stack(
  stackName("health-monitor"),
  stackOptions,
  monitorProgram(healthMonitorWorker.name, {
    artifact: monitorArtifact("health-monitor"),
    className: healthMonitorWorker.className,
    cron: healthMonitorWorker.cron,
    name: healthMonitorWorker.name,
    variables: (config: SharedConfig) =>
      Effect.succeed({
        [healthOriginKey["service-admin"]]: config.origins[APPLICATION.admin],
        [healthOriginKey["service-member"]]: config.origins[APPLICATION.user],
        [healthOriginKey["internal-dashboard"]]: config.origins[APPLICATION.wiki],
      }),
  }),
);

export default stack;
