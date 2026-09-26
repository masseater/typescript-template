import { APPLICATION } from "@repo/config";
import { monitorArtifact, monitorProgram, type SharedConfig } from "@repo/infra-cloudflare/monitor";
import { prefixedStack } from "@repo/infra-cloudflare/prefixed-stack";
import { healthMonitorWorker, healthOriginKey } from "@repo/monitor/workers";
import { Effect } from "effect";

export default prefixedStack(
  "health-monitor",
  monitorProgram("health", {
    artifact: monitorArtifact("health-monitor"),
    className: healthMonitorWorker.className,
    cron: healthMonitorWorker.cron,
    name: healthMonitorWorker.name,
    variables: (config: SharedConfig) =>
      Effect.succeed({
        [healthOriginKey[APPLICATION.serviceAdmin]]: config.origins[APPLICATION.serviceAdmin],
        [healthOriginKey[APPLICATION.serviceMember]]: config.origins[APPLICATION.serviceMember],
        [healthOriginKey[APPLICATION.internalDashboard]]: config.origins[APPLICATION.internalDashboard],
      }),
  }),
);
