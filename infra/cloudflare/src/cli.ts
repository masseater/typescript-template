import { parseDeploymentCommand } from "./config.ts";
import { runWithState } from "@template/infra-bootstrap/state";

type DeploymentCommand = ReturnType<typeof parseDeploymentCommand>;

const FIRST_USER_ARGUMENT_INDEX = 2;

function writeEvent(stream: Readonly<Pick<NodeJS.WriteStream, "write">>, event: unknown): void {
  stream.write(`${JSON.stringify(event)}\n`);
}

async function applyStacks(
  operation: DeploymentCommand["operation"],
  targets: readonly DeploymentCommand["targets"][number][],
): Promise<number> {
  const [next, ...rest] = targets;
  if (next === undefined) {
    return 0;
  }
  writeEvent(process.stdout, {
    dependencies: next.dependencies,
    event: "cloudflare.stack_started",
    stack: next.stack,
  });
  const code = await runWithState([operation, "--cwd", `${import.meta.dirname}/../${next.stack}`]);
  if (code !== 0) {
    writeEvent(process.stderr, { event: "cloudflare.stack_failed", stack: next.stack });
    return code;
  }
  return applyStacks(operation, rest);
}

try {
  const { operation, targets } = parseDeploymentCommand(
    process.argv.slice(FIRST_USER_ARGUMENT_INDEX),
  );
  process.exitCode = await applyStacks(operation, targets);
} catch {
  process.stderr.write(`${JSON.stringify({ event: "cloudflare.command_failed" })}\n`);
  process.exitCode = 1;
}
