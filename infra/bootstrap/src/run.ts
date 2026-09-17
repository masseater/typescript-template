import { runWithState } from "./state.ts";

try {
  const [command, ...args] = process.argv
    .slice(2)
    .filter((arg, index) => !(index === 0 && arg === "--"));
  if (command !== "pulumi") throw new Error("only_pulumi_allowed");
  process.exitCode = await runWithState(args);
} catch {
  console.error(JSON.stringify({ event: "state.command_failed" }));
  process.exitCode = 1;
}
