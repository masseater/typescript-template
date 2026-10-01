import { Array as Arr, Effect, FileSystem, Path, Schema, pipe } from "effect";
import type { Stdio } from "effect";

import {
  blockWhen,
  localBin,
  projectDir,
  readHookInput,
  runCommand,
  runHook,
  writeJson,
} from "./env.ts";
import type { CommandResult } from "./env.ts";

const WORKSPACE_SCOPES: ReadonlySet<string> = new Set(["apps", "libs", "infra", "tools"]);
const SOURCE_EXTENSIONS: ReadonlySet<string> = new Set([".ts", ".tsx"]);

const PostToolUseInput = Schema.Struct({
  tool_input: Schema.Struct({ file_path: Schema.optional(Schema.String) }),
});

const PostToolUseOutput = Schema.Struct({
  hookSpecificOutput: Schema.Struct({
    hookEventName: Schema.Literal("PostToolUse"),
    additionalContext: Schema.String,
  }),
});

const isWorkspace = (scope: string, name: string): boolean =>
  WORKSPACE_SCOPES.has(scope) && name !== "";

const isSourcePath = (segment: string, rest: readonly string[], extension: string): boolean =>
  segment === "src" && !rest.includes("generated") && SOURCE_EXTENSIONS.has(extension);

const locate = Effect.fn("locate")(function* locate(filePath: string) {
  const path = yield* Path.Path;
  const root = path.resolve(yield* projectDir);
  const [scope = "", name = "", segment = "", ...rest] = path
    .relative(root, filePath)
    .split(path.sep);
  const isAppSource =
    isWorkspace(scope, name) && isSourcePath(segment, rest, path.extname(filePath));
  const candidates = [scope, path.join(scope, name)].filter((dir) => dir !== "");
  return { candidates, isAppSource, root };
});

const fallowTargets = Effect.fn("fallowTargets")(function* fallowTargets(
  root: string,
  candidates: readonly string[],
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const withConfig = yield* pipe(
    candidates,
    Effect.filter((dir: string) =>
      fs.exists(path.join(root, dir, ".fallowrc.jsonc")).pipe(Effect.orDie),
    ),
  );
  return [[], ...withConfig.map((dir) => ["-r", dir])];
});

const runFallow = Effect.fn("runFallow")(function* runFallow(
  root: string,
  candidates: readonly string[],
) {
  const fallow = yield* localBin("fallow");
  const targets = yield* fallowTargets(root, candidates);
  const runs = yield* Effect.forEach(
    targets,
    (args) =>
      runCommand(fallow, [
        "--changed-since",
        "HEAD",
        "--production",
        "--quiet",
        "--format",
        "compact",
        ...args,
      ]),
    { concurrency: "unbounded" },
  );
  yield* blockWhen({
    reasons: runs.filter((run) => !run.succeeded).map((run) => run.output),
  });
  return runs;
});

const reportDuplication = (
  runs: readonly CommandResult[],
): Effect.Effect<void, never, Stdio.Stdio> => {
  const duplication = Arr.dedupe(
    runs
      .flatMap((run) => run.stdout.split("\n"))
      .filter((line) => line.startsWith("code-duplication:")),
  );
  if (!Arr.isArrayNonEmpty(duplication)) {
    return Effect.void;
  }
  return writeJson(PostToolUseOutput, {
    hookSpecificOutput: {
      hookEventName: "PostToolUse",
      additionalContext: [
        "fallow が重複を検出した。共通化すべきか判断すること。",
        ...duplication,
      ].join("\n"),
    },
  });
};

const checkStatePolicy = Effect.fn("checkStatePolicy")(function* checkStatePolicy(
  filePath: string,
) {
  const jevLint = yield* localBin("jev-lint");
  const run = yield* runCommand(jevLint, ["check", filePath]);
  yield* blockWhen({
    reasons: [run].filter(({ succeeded }) => !succeeded).map(({ output }) => output),
  });
});

runHook(
  Effect.gen(function* postEdit() {
    const input = yield* readHookInput(PostToolUseInput);
    const filePath = input.tool_input.file_path ?? "";
    const { candidates, isAppSource, root } = yield* locate(filePath);
    const runs = yield* runFallow(root, candidates);
    if (isAppSource) {
      yield* checkStatePolicy(filePath);
    }
    yield* reportDuplication(runs);
  }),
);
