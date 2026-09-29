import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { TypeSafeClient, noul } from "@typesafe-ai/sdk";
import { block, projectDir, readHookInput, requireTypesafeKey } from "./env.ts";

type PostToolUseInput = { readonly tool_input: { readonly file_path?: string } };

const input = await readHookInput<PostToolUseInput>();
const filePath = input.tool_input.file_path ?? "";
const [scope = "", name = "", ...rest] = relative(projectDir, filePath).split(sep);
const workspace =
  ["apps", "libs", "infra", "tools"].includes(scope) && name !== "" ? join(scope, name) : undefined;

const fallow = (...args: Array<string>) =>
  spawnSync(
    join(projectDir, "node_modules/.bin/fallow"),
    ["--changed-since", "HEAD", "--production", "--quiet", "--format", "compact", ...args],
    {
      cwd: projectDir,
      encoding: "utf8",
    },
  );

const runs = [
  fallow(),
  ...(workspace !== undefined && existsSync(join(projectDir, workspace, ".fallowrc.jsonc"))
    ? [fallow("-r", workspace)]
    : []),
];
const failed = runs.filter((run) => run.status !== 0);
if (failed.length > 0) {
  block(failed.map((run) => `${run.stdout}${run.stderr}`).join("\n"));
}

const duplication = [
  ...new Set(
    runs
      .flatMap((run) => run.stdout.split("\n"))
      .filter((line) => line.startsWith("code-duplication:")),
  ),
];
const finish = (): never => {
  if (duplication.length > 0) {
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "PostToolUse",
          additionalContext: [
            "fallow が重複を検出した。共通化すべきか判断すること。",
            ...duplication,
          ].join("\n"),
        },
      }),
    );
  }
  process.exit(0);
};

const isAppSource =
  workspace !== undefined &&
  rest[0] === "src" &&
  /\.(ts|tsx)$/.test(filePath) &&
  !filePath.includes(`${sep}generated${sep}`);
if (!isAppSource) {
  finish();
}

requireTypesafeKey();

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

try {
  const { answers } = await new TypeSafeClient().systemOne({
    state: readFileSync(filePath, "utf8"),
    questions: policy,
  });
  const violations = Object.entries(messages).filter(
    ([key]) => answers[key as keyof typeof policy].noul > 0.5,
  );
  if (violations.length > 0) {
    block([`jev: ${filePath}`, ...violations.map(([, message]) => `- ${message}`)].join("\n"));
  }
} catch (error) {
  block(`jev の状態ポリシー検査を実行できなかった: ${String(error)}`);
}
finish();
