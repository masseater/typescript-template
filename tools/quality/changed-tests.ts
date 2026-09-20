import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";

import { causeRecord, runCli } from "@repo/config/cli";
import { Cause, Console, Effect, Option, Schema } from "effect";

import { repositoryRoot } from "./repository-root.ts";

const MAX_OUTPUT_BYTES = 33_554_432;
const BASE_VARIABLE = "TEST_CHANGED_SINCE";
const LOCAL_BASE = "origin/main";
const run = promisify(execFile);

class ChangedTestsFailure extends Schema.TaggedError<ChangedTestsFailure>()("ChangedTestsFailure", {
  base: Schema.optional(Schema.String),
  command: Schema.optional(Schema.String),
  reason: Schema.Literals([
    "base_missing_in_ci",
    "base_unresolvable",
    "git_failed",
    "tests_failed",
  ]),
}) {}

const git = (args: readonly string[]): Effect.Effect<string, ChangedTestsFailure> => {
  return Effect.tryPromise({
    catch: () =>
      new ChangedTestsFailure({ command: `git ${args.join(" ")}`, reason: "git_failed" }),
    try: async () => {
      const { stdout } = await run("git", [...args], {
        cwd: repositoryRoot,
        maxBuffer: MAX_OUTPUT_BYTES,
      });
      return stdout;
    },
  });
};

const lines = (output: string): readonly string[] => {
  return output.split("\n").filter((line) => line !== "");
};

const baseRevision = Effect.gen(function* baseRevision() {
  const configured = process.env[BASE_VARIABLE];
  if (configured !== undefined && configured !== "") {
    return configured;
  }
  if (process.env["CI"] !== undefined) {
    return yield* new ChangedTestsFailure({ reason: "base_missing_in_ci" });
  }
  return LOCAL_BASE;
});

const resolvable = (base: string): Effect.Effect<void, ChangedTestsFailure> => {
  return git(["rev-parse", "--verify", "--quiet", `${base}^{commit}`]).pipe(
    Effect.mapError(() => new ChangedTestsFailure({ base, reason: "base_unresolvable" })),
    Effect.asVoid,
  );
};

const changedFiles = (base: string): Effect.Effect<readonly string[], ChangedTestsFailure> => {
  return Effect.all([
    git(["diff", "--name-only", `${base}...HEAD`]),
    git(["diff", "--cached", "--name-only"]),
    git(["ls-files", "--others", "--modified", "--exclude-standard"]),
  ]).pipe(Effect.map((outputs) => [...new Set(outputs.flatMap(lines))].toSorted()));
};

const runChangedTests = (base: string): Effect.Effect<void, ChangedTestsFailure> => {
  return Effect.callback<void, ChangedTestsFailure>((resume) => {
    const child = spawn(
      "vp",
      ["test", "run", "--project", "!@repo/*", "--changed", base, "--passWithNoTests"],
      { cwd: repositoryRoot, stdio: "inherit" },
    );
    child.once("error", () => {
      resume(Effect.fail(new ChangedTestsFailure({ base, reason: "tests_failed" })));
    });
    child.once("exit", (code) => {
      resume(
        code === 0
          ? Effect.void
          : Effect.fail(new ChangedTestsFailure({ base, reason: "tests_failed" })),
      );
    });
    return Effect.sync(() => {
      child.kill();
    });
  });
};

const program = Effect.gen(function* program() {
  const base = yield* baseRevision;
  yield* resolvable(base);
  const changed = yield* changedFiles(base);
  yield* Console.log(
    JSON.stringify({ base, changed: changed.length, event: "quality.changed_tests", ok: true }),
  );
  if (changed.length > 0) {
    yield* runChangedTests(base);
  }
});

runCli(program, (cause) => {
  const failure = Option.getOrUndefined(Cause.findErrorOption(cause));
  return failure === undefined
    ? causeRecord("quality.changed_tests_failed", cause)
    : {
        base: failure.base,
        command: failure.command,
        event: "quality.changed_tests_failed",
        ok: false,
        reason: failure.reason,
      };
});
