import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { NodeRuntime } from "@effect/platform-node";
import { Effect } from "effect";
import { secretViolations } from "./secrets.ts";

const run = promisify(execFile);
const root = fileURLToPath(new URL("../../", import.meta.url));
const options = { cwd: root, maxBuffer: 32 * 1024 * 1024 };
const git = (args: readonly string[]) => Effect.tryPromise(() => run("git", [...args], options));

NodeRuntime.runMain(
  Effect.gen(function* () {
    const { stdout } = yield* git(["ls-files", "--cached", "-z"]);
    const failures: { file: string; rules: string[] }[] = [];
    for (const file of stdout.split("\0").filter(Boolean)) {
      const staged = yield* git(["show", `:${file}`]);
      const rules = secretViolations(file, staged.stdout);
      if (rules.length) failures.push({ file, rules });
    }
    console.log(
      JSON.stringify({ event: "quality.staged_secrets", ok: failures.length === 0, failures }),
    );
    if (failures.length) process.exitCode = 1;
  }).pipe(
    Effect.catchCause(() =>
      Effect.sync(() => {
        console.error(JSON.stringify({ event: "quality.staged_secrets_failed", ok: false }));
        process.exitCode = 1;
      }),
    ),
  ),
  { disableErrorReporting: true },
);
