import { Stack } from "alchemy";
import { Effect } from "effect";

import { monitorArtifact } from "./artifacts.ts";
import { monitorProgram } from "./monitor.ts";
import { stackName, stackOptions } from "./stacks.ts";

import type { SharedConfig } from "./config.ts";

const stack = Stack(
  stackName("health-monitor"),
  stackOptions,
  monitorProgram("health", {
    artifact: monitorArtifact("health-monitor"),
    className: "HealthMonitor",
    cron: "37 * * * *",
    name: "health",
    variables: (config: SharedConfig) =>
      Effect.succeed({
        SERVICE_ADMIN_ORIGIN: config.origins["service-admin"],
        SERVICE_MEMBER_ORIGIN: config.origins["service-member"],
        INTERNAL_DASHBOARD_ORIGIN: config.origins["internal-dashboard"],
      }),
  }),
);

export default stack;
