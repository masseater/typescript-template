import { Effect } from "effect";
import { NodeRuntime } from "@effect/platform-node";
// oxlint-disable-next-line import/no-nodejs-modules
import { execFile } from "node:child_process";
// oxlint-disable-next-line import/no-nodejs-modules
import { fileURLToPath } from "node:url";
// oxlint-disable-next-line import/no-nodejs-modules
import { promisify } from "node:util";
import { secretViolations } from "./secrets.ts";

interface StagedFailure {
  readonly file: string;
  readonly rules: string[];
}

const MAX_OUTPUT_BYTES = 33_554_432;

// oxlint-disable-next-line typescript/strict-void-return
const run = promisify(execFile);
const root = fileURLToPath(new URL("../../", import.meta.url));
const options = { cwd: root, maxBuffer: MAX_OUTPUT_BYTES };

function git(args: readonly string[]): Effect.Effect<string, unknown> {
  return Effect.tryPromise(async () => run("git", [...args], options)).pipe(
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
    Effect.map(({ stdout }) => stdout),
  );
}

function stagedFailure(file: string): Effect.Effect<StagedFailure[], unknown> {
  return git(["show", `:${file}`]).pipe(
    Effect.map((content) => {
      const rules = secretViolations(file, content);
      return rules.length > 0 ? [{ file, rules }] : [];
    }),
  );
}

const scanStaged = Effect.fn("scanStaged")(function* scanStaged() {
  const listed = yield* git(["ls-files", "--cached", "-z"]);
  const files = listed.split("\0").filter(Boolean);
  const failures = yield* Effect.all(files.map((file) => stagedFailure(file)));
  return failures.flat();
});

NodeRuntime.runMain(
  scanStaged().pipe(
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
    Effect.flatMap((failures) =>
      Effect.sync(() => {
        process.stdout.write(
          `${JSON.stringify({ event: "quality.staged_secrets", failures, ok: failures.length === 0 })}\n`,
        );
        if (failures.length > 0) {
          process.exitCode = 1;
        }
      }),
    ),
    Effect.catchCause(() =>
      Effect.sync(() => {
        process.stderr.write(
          `${JSON.stringify({ event: "quality.staged_secrets_failed", ok: false })}\n`,
        );
        process.exitCode = 1;
      }),
    ),
  ),
  { disableErrorReporting: true },
);
