import { runCli } from "@repo/config/cli";
import { Effect } from "effect";

import { parseDeploymentCommand } from "./config.ts";
import { deploymentAccess } from "./deployment-access.ts";
import { causeRecord, reportCause } from "./secrets.ts";
import { runDeployment } from "./stack-runner.ts";

const FIRST_USER_ARGUMENT_INDEX = 2;
const EVENT = "cloudflare.command_rejected";

runCli(
  Effect.gen(function* program() {
    const request = yield* parseDeploymentCommand(process.argv.slice(FIRST_USER_ARGUMENT_INDEX));
    const { access, confidential, config, secrets } = yield* deploymentAccess();
    yield* runDeployment(request, { access, config, secrets }).pipe(
      Effect.catchCause((cause) => reportCause(EVENT, cause, confidential)),
    );
  }),
  (cause) => causeRecord(EVENT, cause),
);
