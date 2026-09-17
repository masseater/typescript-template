import { reportCause, withVerifiedSecrets } from "./secrets.ts";
import { Effect } from "effect";
import { NodeRuntime } from "@effect/platform-node";
import { parseDeploymentCommand } from "./config.ts";
import { runDeployment } from "./stack-runner.ts";
import { settings } from "./settings.ts";
import { verifiedSecrets } from "./credentials.ts";

const FIRST_USER_ARGUMENT_INDEX = 2;

NodeRuntime.runMain(
  Effect.gen(function* program() {
    const request = yield* parseDeploymentCommand(process.argv.slice(FIRST_USER_ARGUMENT_INDEX));
    const secrets = yield* verifiedSecrets();
    const { accountId, prefix } = yield* withVerifiedSecrets(secrets, settings);
    yield* runDeployment(request, secrets, { accountId, prefix });
  }).pipe(
    Effect.catchCause(
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
      (cause) => reportCause("cloudflare.command_rejected", cause),
    ),
  ),
  { disableErrorReporting: true },
);
