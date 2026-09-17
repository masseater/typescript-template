import { stackName, stackOptions } from "./stacks.ts";
import { Effect } from "effect";
import { Stack } from "alchemy";
import { accountTokenRef } from "./tokens.ts";
import { monitorArtifact } from "./artifacts.ts";
import { monitorProgram } from "./monitor.ts";

const stack = Stack(
  stackName("error-monitor"),
  stackOptions,
  monitorProgram("error", {
    artifact: monitorArtifact("error-monitor"),
    className: "ErrorMonitor",
    cron: "*/5 * * * *",
    name: "errors",
    variables: Effect.fn("errorVariables")(function* errorVariables(config) {
      const token = yield* accountTokenRef("ObservabilityQuery");
      return { CLOUDFLARE_ACCOUNT_ID: config.accountId, OBSERVABILITY_TOKEN: token.value };
    }),
  }),
);

// oxlint-disable-next-line import/no-default-export
export default stack;
