import { Array as Arr, Effect, Option, Schema, String as Str, pipe } from "effect";

import {
  blockWhen,
  localBin,
  projectRoot,
  readHookInput,
  runCommand,
  runHook,
  writeJson,
} from "./env.ts";
import { ROOT, fallowConfigFile } from "./fallow-config.ts";
import { HookPlatform } from "./platform.ts";
import type { CommandResult } from "./platform.ts";

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
  const platform = yield* HookPlatform;
  const root = yield* projectRoot;
  const segments = pipe(platform.relative(root, filePath), Str.split(platform.sep));
  const [scope, name = ""] = segments;
  const candidates = pipe(
    [scope, platform.join(scope, name)],
    Arr.filter((dir) => dir !== ""),
  );
  return candidates;
});

const runFallowIn = Effect.fn("runFallowIn")(function* runFallowIn(
  fallow: string,
  directory: string,
) {
  const configFile = yield* fallowConfigFile(directory);
  return yield* Option.match(configFile, {
    onNone: () => Effect.succeedNone,
    onSome: (file) =>
      Effect.asSome(
        runCommand(fallow, [
          "--changed-since",
          "HEAD",
          "--quiet",
          "--format",
          "compact",
          "-r",
          directory,
          "-c",
          file,
        ]),
      ),
  });
});

const runFallow = Effect.fn("runFallow")(function* runFallow(candidates: readonly string[]) {
  const fallow = yield* localBin("fallow");
  const runs = yield* Effect.forEach(
    [ROOT, ...candidates],
    (directory) => runFallowIn(fallow, directory),
    { concurrency: "unbounded" },
  ).pipe(Effect.map(Arr.getSomes), Effect.scoped);
  const failed = pipe(
    runs,
    Arr.filter((run) => !run.succeeded),
    Arr.map((run) => run.output),
  );
  yield* blockWhen(failed);
  return runs;
});

const reportDuplication = (
  runs: readonly CommandResult[],
): Effect.Effect<void, never, HookPlatform> => {
  const lines = pipe(
    runs,
    Arr.flatMap((run) => pipe(run.stdout, Str.split("\n"))),
  );
  const duplication = pipe(lines, Arr.filter(Str.startsWith("code-duplication:")), Arr.dedupe);
  if (!Arr.isArrayNonEmpty(duplication)) {
    return Effect.void;
  }
  return writeJson(PostToolUseOutput, {
    hookSpecificOutput: {
      hookEventName: "PostToolUse",
      additionalContext: pipe(
        ["fallow が重複を検出した。共通化すべきか判断すること。", ...duplication],
        Arr.join("\n"),
      ),
    },
  });
};

runHook(
  Effect.gen(function* postEdit() {
    const input = yield* readHookInput(PostToolUseInput);
    const filePath = input.tool_input.file_path ?? "";
    const candidates = yield* locate(filePath);
    const runs = yield* runFallow(candidates);
    yield* reportDuplication(runs);
  }),
);
