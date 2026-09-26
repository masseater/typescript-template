#!/usr/bin/env node
import { NodeServices } from "@effect/platform-node";
import { runCli, runCommand } from "@repo/cli";
import { Effect } from "effect";

import { withDeploymentAccess } from "./deployment-access.ts";
import { deploymentCommand } from "./deployment-command.ts";
import { causeRecord } from "./secrets.ts";
import { runDeployment } from "./stack-runner.ts";

const EVENT = "cloudflare.command_rejected";

runCli(
  deploymentCommand((request) =>
    withDeploymentAccess(EVENT, ({ access, config, secrets }) =>
      runDeployment(request, { access, config, secrets }),
    ),
  ).pipe(runCommand({ version: "0.0.0" }), Effect.provide(NodeServices.layer)),
  (cause) => causeRecord(EVENT, cause),
);
