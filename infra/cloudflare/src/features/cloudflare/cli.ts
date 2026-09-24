#!/usr/bin/env node
import { parseDeploymentCommand } from "./config.ts";
import { runDeploymentCommand } from "./deployment-access.ts";
import { runDeployment } from "./stack-runner.ts";

const FIRST_USER_ARGUMENT_INDEX = 2;

runDeploymentCommand(
  "cloudflare.command_rejected",
  parseDeploymentCommand(process.argv.slice(FIRST_USER_ARGUMENT_INDEX)),
  (request, { access, config, secrets }) => runDeployment(request, { access, config, secrets }),
);
