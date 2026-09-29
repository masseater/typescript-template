import { Array as Arr, Effect, FileSystem, Option, Path, Schema } from "effect";
import type { Stdio } from "effect";

import { blockWhen, projectDir, readHookInput, runCommand, runHook, writeJson } from "./env.ts";
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

const locate = Effect.fn("locate")(function* locate(filePath: string) {
  const path = yield* Path.Path;
  const root = path.resolve(yield* projectDir);
  const [scope = "", name = "", segment = "", ...rest] = path
    .relative(root, filePath)
    .split(path.sep);
  const workspace = Option.some(path.join(scope, name)).pipe(
    Option.filter(() => WORKSPACE_SCOPES.has(scope) && name !== ""),
  );
  const isAppSource =
    Option.isSome(workspace) &&
    segment === "src" &&
    !rest.includes("generated") &&
    SOURCE_EXTENSIONS.has(path.extname(filePath));
  return { isAppSource, root, workspace };
});

const fallowTargets = Effect.fn("fallowTargets")(function* fallowTargets(
  root: string,
  workspace: Option.Option<string>,
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const withConfig = yield* Effect.filter(Option.toArray(workspace), (dir) =>
    fs.exists(path.join(root, dir, ".fallowrc.jsonc")).pipe(Effect.orDie),
  );
  return [[], ...withConfig.map((dir) => ["-r", dir])];
});

const runFallow = Effect.fn("runFallow")(function* runFallow(
  root: string,
  workspace: Option.Option<string>,
) {
  const path = yield* Path.Path;
  const fallow = path.join(root, "node_modules", ".bin", "fallow");
  const targets = yield* fallowTargets(root, workspace);
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
  root: string,
  filePath: string,
) {
  const path = yield* Path.Path;
  const jevLint = path.join(root, "node_modules", ".bin", "jev-lint");
  const run = yield* runCommand(jevLint, ["check", filePath]);
  yield* blockWhen({
    reasons: [run].filter(({ succeeded }) => !succeeded).map(({ output }) => output),
  });
});

runHook(
  Effect.gen(function* postEdit() {
    const input = yield* readHookInput(PostToolUseInput);
    const filePath = input.tool_input.file_path ?? "";
    const { isAppSource, root, workspace } = yield* locate(filePath);
    const runs = yield* runFallow(root, workspace);
    if (isAppSource) {
      yield* checkStatePolicy(root, filePath);
    }
    yield* reportDuplication(runs);
  }),
);
