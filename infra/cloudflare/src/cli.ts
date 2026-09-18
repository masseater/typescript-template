import { Effect } from "effect";
import { NodeRuntime } from "@effect/platform-node";
import { deploymentAccess } from "./deployment-access.ts";
import { parseDeploymentCommand } from "./config.ts";
import { reportCause } from "./secrets.ts";
import { runDeployment } from "./stack-runner.ts";

const FIRST_USER_ARGUMENT_INDEX = 2;
const EVENT = "cloudflare.command_rejected";

NodeRuntime.runMain(
  Effect.gen(function* program() {
    const request = yield* parseDeploymentCommand(process.argv.slice(FIRST_USER_ARGUMENT_INDEX));
    const { access, confidential, config, secrets } = yield* deploymentAccess();
    yield* runDeployment(request, {
      access,
      secrets,
      target: { accountId: config.accountId, prefix: config.prefix },
    }).pipe(Effect.catchCause((cause) => reportCause(EVENT, cause, confidential)));
  }).pipe(Effect.catchCause((cause) => reportCause(EVENT, cause))),
  { disableErrorReporting: true },
);
