import { fileURLToPath } from "node:url";
import { parseDeploymentCommand } from "./config.ts";
import { runWithState } from "@template/infra-bootstrap/state";

const FIRST_USER_ARGUMENT_INDEX = 2;

try {
  const { operation, target } = parseDeploymentCommand(
    process.argv.slice(FIRST_USER_ARGUMENT_INDEX),
  );
  process.exitCode = await runWithState([
    operation,
    "--cwd",
    fileURLToPath(new URL(`../${target}`, import.meta.url)),
  ]);
} catch {
  process.stderr.write(`${JSON.stringify({ event: "cloudflare.command_failed" })}\n`);
  process.exitCode = 1;
}
