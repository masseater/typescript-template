import { TypeSafeClient, noul } from "@typesafe-ai/sdk";
import { Array as Arr, Effect, FileSystem, Option, Path, Schema } from "effect";
import type { Stdio } from "effect";

import {
  HookBlocked,
  blockWhen,
  projectDir,
  readHookInput,
  runCommand,
  runHook,
  typesafeApiKey,
  writeJson,
} from "./env.ts";
import type { CommandResult } from "./env.ts";

const WORKSPACE_SCOPES: ReadonlySet<string> = new Set(["apps", "libs", "infra", "tools"]);
const SOURCE_EXTENSIONS: ReadonlySet<string> = new Set([".ts", ".tsx"]);
const VIOLATION_THRESHOLD = 0.5;

const PostToolUseInput = Schema.Struct({
  tool_input: Schema.Struct({ file_path: Schema.optional(Schema.String) }),
});

const PostToolUseOutput = Schema.Struct({
  hookSpecificOutput: Schema.Struct({
    hookEventName: Schema.Literal("PostToolUse"),
    additionalContext: Schema.String,
  }),
});

const policy = {
  exclusiveStatus: noul(
    "Does this code represent a single piece of state with several boolean flags or optional fields that can contradict each other, instead of one exclusive status expressed as a discriminated union?",
  ),
  uiState: noul(
    "Does this code hold client-side UI state with anything other than effect-atom (for example useState, useReducer, React context used as a store, zustand, jotai, redux)?",
  ),
  serverState: noul(
    "Does this code fetch, cache or synchronize server data on the client with anything other than TanStack Query (for example fetch inside useEffect, SWR, a hand-written cache)?",
  ),
};

const messages = {
  exclusiveStatus:
    "状態を boolean フラグの組で表している可能性がある。排他的な status を判別共用体で表すこと。",
  uiState:
    "UI 状態を effect-atom 以外で持っている可能性がある。UI 状態は effect-atom だけで扱うこと。",
  serverState:
    "サーバー状態を TanStack Query 以外で扱っている可能性がある。サーバー状態は TanStack Query だけで扱うこと。",
} satisfies Record<keyof typeof policy, string>;

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
  filePath: string,
) {
  const fs = yield* FileSystem.FileSystem;
  const apiKey = yield* typesafeApiKey;
  const state = yield* fs.readFileString(filePath).pipe(Effect.orDie);
  const { answers } = yield* Effect.tryPromise({
    try: () => new TypeSafeClient({ apiKey }).systemOne({ state, questions: policy }),
    catch: (error) =>
      new HookBlocked({ reason: `jev の状態ポリシー検査を実行できなかった: ${String(error)}` }),
  });
  const violations = Arr.fromRecord(messages).filter(
    ([key]) => answers[key].noul > VIOLATION_THRESHOLD,
  );
  yield* blockWhen({
    heading: [`jev: ${filePath}`],
    reasons: violations.map(([, message]) => `- ${message}`),
  });
});

runHook(
  Effect.gen(function* postEdit() {
    const input = yield* readHookInput(PostToolUseInput);
    const filePath = input.tool_input.file_path ?? "";
    const { isAppSource, root, workspace } = yield* locate(filePath);
    const runs = yield* runFallow(root, workspace);
    if (isAppSource) {
      yield* checkStatePolicy(filePath);
    }
    yield* reportDuplication(runs);
  }),
);
