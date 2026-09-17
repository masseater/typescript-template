import { stackName, stackOptions } from "./stacks.ts";
import { Effect } from "effect";
import type { SharedConfig } from "./config.ts";
import { Stack } from "alchemy";
import { healthWorkerArtifact } from "@template/health-monitor/artifact";
import { monitorProgram } from "./monitor.ts";

const stack = Stack(
  stackName("health-monitor"),
  stackOptions,
  monitorProgram("health", {
    artifact: healthWorkerArtifact,
    className: "HealthMonitor",
    cron: "37 * * * *",
    name: "health",
    variables: (config: SharedConfig) =>
      Effect.succeed({
        ADMIN_ORIGIN: config.origins.admin,
        USER_ORIGIN: config.origins.user,
        WIKI_ORIGIN: config.origins.wiki,
      }),
  }),
);

// oxlint-disable-next-line import/no-default-export
export default stack;
