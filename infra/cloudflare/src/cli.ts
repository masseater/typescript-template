import { fileURLToPath } from "node:url";
import { runWithState } from "@template/infra-bootstrap/state";
import { parseDeploymentCommand } from "./config.ts";

try {
  const { operation, targets } = parseDeploymentCommand(process.argv.slice(2));
  for (const { stack, dependencies } of targets) {
    console.info(JSON.stringify({ event: "cloudflare.stack_started", stack, dependencies }));
    const code = await runWithState([
      operation,
      "--cwd",
      fileURLToPath(new URL(`../${stack}`, import.meta.url)),
    ]);
    if (code !== 0) {
      console.error(JSON.stringify({ event: "cloudflare.stack_failed", stack }));
      process.exitCode = code;
      break;
    }
  }
} catch {
  console.error(JSON.stringify({ event: "cloudflare.command_failed" }));
  process.exitCode = 1;
}
