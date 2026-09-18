// oxlint-disable-next-line import/no-nodejs-modules
import os from "node:os";
// oxlint-disable-next-line import/no-nodejs-modules
import path from "node:path";

import { Effect, FileSystem, Schema } from "effect";

class PromptFailure extends Schema.TaggedError<PromptFailure>()("PromptFailure", {
  cause: Schema.optionalKey(Schema.Defect()),
  reason: Schema.Literals(["asset_unreadable", "installed_skill_referenced"]),
}) {}

interface CommanderPrompt {
  readonly scripts: string;
  readonly systemPrompt: string;
}

const installedSkills = ".claude/skills/";
const bundledAssets = path.join(path.dirname(import.meta.dirname), "assets");

function render(text: string, assets: string): Effect.Effect<string, PromptFailure> {
  const installed = path.join(os.homedir(), ".claude", "skills");
  const rendered = text
    .replaceAll(path.join(installed, "commander"), path.join(assets, "commander"))
    .replaceAll(path.join(installed, "coordinator"), path.join(assets, "coordinator"));
  return rendered.includes(installedSkills)
    ? Effect.fail(new PromptFailure({ reason: "installed_skill_referenced" }))
    : Effect.succeed(rendered);
}

function sessionRules(scripts: string, coordinator: string): string {
  return [
    "## このセッションについて（アプリが毎回付ける固定の指示）",
    "",
    "- このセッションは常に司令塔（commander）である。ユーザーの発言はすべて司令塔への依頼か質問として扱う。スキルやコマンドが呼ばれるのを待たない。",
    `- 使えるのは Bash（bd、${scripts}/ のスクリプト、claude agents、claude --bg、jq だけが許可されている）と Read / Grep / Glob だけで、それ以外は拒否される。スクリプトは変数を使わず ${scripts}/status.sh のように絶対パスで実行する。リダイレクトとコマンド置換は使わない。`,
    `- coordinator を起動するときは、上の \`/loop 10m /coordinator\` の代わりに \`claude --bg --name coordinator-<プロジェクト名> "${coordinator} を読んで tick を 1 回実行する。これを 10 分おきに繰り返す"\` を使う。`,
    "- 「見張り」のバックグラウンド実行は、このアプリでは実行できないので行わない。",
    "- ユーザーは画面の右側でタスクの一覧とコメントを見ていて、タスクへのコメントは自分でも書ける。",
    "- 返答は短い日本語で書く。",
  ].join("\n");
}

const commanderPrompt = Effect.fn("commanderPrompt")(function* commanderPrompt(
  assets: string,
  stateDirectory: string,
) {
  const files = yield* FileSystem.FileSystem;
  const scripts = path.join(assets, "commander", "scripts");
  const coordinator = path.join(stateDirectory, "coordinator.md");
  const prepared = Effect.gen(function* prepared() {
    const commanderSkill = yield* files.readFileString(path.join(assets, "commander", "SKILL.md"));
    const coordinatorSkill = yield* files.readFileString(
      path.join(assets, "coordinator", "SKILL.md"),
    );
    yield* files.makeDirectory(stateDirectory, { recursive: true });
    return { commanderSkill, coordinatorSkill };
  }).pipe(Effect.mapError((cause) => new PromptFailure({ cause, reason: "asset_unreadable" })));
  const { commanderSkill, coordinatorSkill } = yield* prepared;
  const tick = yield* render(coordinatorSkill, assets);
  yield* files
    .writeFileString(coordinator, tick)
    .pipe(Effect.mapError((cause) => new PromptFailure({ cause, reason: "asset_unreadable" })));
  const skill = yield* render(commanderSkill, assets);
  const prompt: CommanderPrompt = {
    scripts,
    systemPrompt: `${skill}\n\n${sessionRules(scripts, coordinator)}`,
  };
  return prompt;
});

export { bundledAssets, commanderPrompt };
export type { CommanderPrompt };
