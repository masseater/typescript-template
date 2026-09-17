import { runWithState } from "./state.ts";

const FIRST_USER_ARGUMENT_INDEX = 2;

try {
  const [command, ...args] = process.argv
    .slice(FIRST_USER_ARGUMENT_INDEX)
    .filter((arg, index) => !(index === 0 && arg === "--"));
  if (command !== "pulumi") {
    throw new Error("only_pulumi_allowed");
  }
  process.exitCode = await runWithState(args);
} catch {
  process.stderr.write(`${JSON.stringify({ event: "state.command_failed" })}\n`);
  process.exitCode = 1;
}
