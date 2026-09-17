import { fileURLToPath } from "node:url";
import { runWithState } from "@template/infra-bootstrap/state";
import { parseDeploymentCommand } from "./config.ts";

try {
  const { operation, target } = parseDeploymentCommand(process.argv.slice(2));
  process.exitCode = await runWithState([
    operation,
    "--cwd",
    fileURLToPath(new URL(`../${target}`, import.meta.url)),
  ]);
} catch {
  console.error(JSON.stringify({ event: "cloudflare.command_failed" }));
  process.exitCode = 1;
}
