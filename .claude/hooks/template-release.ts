import { Effect, FileSystem, Path, Schema, String as Str } from "effect";
import { HttpClient, HttpClientRequest, HttpClientResponse } from "effect/http";

import { projectDir, runHook, writeJson } from "./env.ts";

const TEMPLATE_REPOSITORY = "masseater/typescript-template";
const MANIFEST_FILE = ".github/release-please/manifest.json";
const REQUEST_TIMEOUT = "5 seconds";
const NOTES_LENGTH = 4000;
const WORKTREE_SEGMENT = "/.claude/worktrees/";

const Manifest = Schema.Struct({ ".": Schema.String });

const Release = Schema.Struct({
  tag_name: Schema.String,
  html_url: Schema.String,
  body: Schema.NullOr(Schema.String),
});

const SessionStartOutput = Schema.Struct({
  systemMessage: Schema.String,
  hookSpecificOutput: Schema.Struct({
    hookEventName: Schema.Literal("SessionStart"),
    additionalContext: Schema.String,
  }),
});

const currentVersion = Effect.gen(function* currentVersion() {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const text = yield* fs.readFileString(path.join(yield* projectDir, MANIFEST_FILE));
  const manifest = yield* Schema.decodeEffect(Schema.fromJsonString(Manifest))(text);
  return `v${manifest["."]}`;
});

const latestRelease = Effect.gen(function* latestRelease() {
  const client = yield* HttpClient.HttpClient;
  const request = HttpClientRequest.get(
    `https://api.github.com/repos/${TEMPLATE_REPOSITORY}/releases/latest`,
    { acceptJson: true },
  );
  const response = yield* client
    .execute(request)
    .pipe(Effect.flatMap(HttpClientResponse.filterStatusOk));
  return yield* HttpClientResponse.schemaBodyJson(Release)(response);
}).pipe(Effect.timeout(REQUEST_TIMEOUT));

const instructions = (current: string, release: typeof Release.Type): string => {
  const latest = release.tag_name;
  const remote = `https://github.com/${TEMPLATE_REPOSITORY}.git`;
  return [
    `このリポジトリの元になったテンプレート ${TEMPLATE_REPOSITORY} に新しいリリース ${latest} がある。このリポジトリが取り込んでいるのは ${current} である。`,
    "最初の応答で、この更新があることと主な変更点をユーザーに伝え、最新状態を取り込むかを聞く。ユーザーの作業依頼があっても、先にこの確認をする。",
    "取り込むと答えたら、次の手順で差分を取り込む。",
    `1. git fetch --no-tags ${remote} refs/tags/${current}:refs/template/${current} refs/tags/${latest}:refs/template/${latest}`,
    `2. git diff refs/template/${current} refs/template/${latest} | git apply --3way`,
    "3. 衝突を解消し、vp install と vp run verify を通してからコミットする。",
    "取り込まないと答えたら、何もしない。",
    `リリースページ: ${release.html_url}`,
    "リリースノート:",
    Str.takeLeft(release.body ?? "", NOTES_LENGTH),
  ].join("\n");
};

runHook(
  Effect.gen(function* templateRelease() {
    if ((yield* projectDir).includes(WORKTREE_SEGMENT)) {
      return;
    }
    const current = yield* currentVersion;
    const release = yield* latestRelease;
    if (release.tag_name === current) {
      return;
    }
    yield* writeJson(SessionStartOutput, {
      systemMessage: `テンプレート ${TEMPLATE_REPOSITORY} に新しいリリース ${release.tag_name} があります（現在 ${current}）。`,
      hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext: instructions(current, release),
      },
    });
  }).pipe(Effect.ignore),
);
