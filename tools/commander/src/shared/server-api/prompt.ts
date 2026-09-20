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
const placeholder = "{{";

function render(text: string, assets: string): Effect.Effect<string, PromptFailure> {
  const rendered = text.replaceAll("{{commander}}", path.join(assets, "commander"));
  return rendered.includes(installedSkills) || rendered.includes(placeholder)
    ? Effect.fail(new PromptFailure({ reason: "installed_skill_referenced" }))
    : Effect.succeed(rendered);
}

interface Rules {
  readonly coordinator: string;
  readonly coordinatorName: string;
  readonly scripts: string;
}

function sessionRules({ coordinator, coordinatorName, scripts }: Rules): string {
  return [
    "## このセッションについて（アプリが毎回付ける固定の指示）",
    "",
    "- このセッションは常に司令塔（commander）である。ユーザーの発言はすべて司令塔への依頼か質問として扱う。スキルやコマンドが呼ばれるのを待たない。",
    `- 使えるのは Bash（bd、${scripts}/ のスクリプト、claude agents、claude --bg、jq だけが許可されている）と Read / Grep / Glob だけで、それ以外は拒否される。スクリプトは変数を使わず ${scripts}/status.sh のように絶対パスで実行する。リダイレクトとコマンド置換は使わない。`,
    `- コマンドの前に付けられる環境変数は \`BEADS_ACTOR=commander\` と、dispatch.sh に限り \`WORKER_MODEL=haiku\` / \`WORKER_MODEL=sonnet\` / \`WORKER_MODEL=opus\` だけ。BEADS_ACTOR は最初から commander に設定されているので省いてよい。`,
    "- bd データベースはアプリが用意するので `bd init` は実行しない。",
    `- coordinator が居るかは \`claude agents --json | jq '.[] | select(.name == "${coordinatorName}")'\` で確かめる。居なければ、プロジェクトのディレクトリで次をそのまま実行する: \`claude --bg --name ${coordinatorName} --model sonnet "${coordinator} を読んで tick を 1 回実行する。これを 10 分おきに繰り返す"\``,
    "- アプリが台帳を見張っていて、レビュー待ち・ユーザーの判断待ち・空きがあるのに未着手の bead が出ると「アプリの見張りからの呼び出し」としてこのセッションを起こす。ユーザーには、離れていてもレビューと次の着手は自動で進むと伝えてよい。",
    "- 発言の先頭に「アプリが見ている台帳の現況」が付いていたら、そこに挙がった bead を「最初にやること」で必ず片付けてから本題に答える。状況を読み上げるだけで終わらない。",
    "- ユーザーは画面の右側でタスクの一覧とコメントを見ていて、タスクへのコメントは自分でも書ける。",
    "- 返答は短い日本語で、普通の文と改行だけで書く。Markdown 記法（**、#、```、表、- の箇条書き）は画面にそのまま出てしまうので使わない。",
  ].join("\n");
}

function sessionName(directory: string, stateDirectory: string): string {
  const project = path.basename(directory).replaceAll(/[^A-Za-z0-9._-]/gu, "-");
  return `coordinator-${project}-${path.basename(stateDirectory)}`;
}

interface PromptSource {
  readonly assets: string;
  readonly directory: string;
  readonly stateDirectory: string;
}

const commanderPrompt = Effect.fn("commanderPrompt")(function* commanderPrompt({
  assets,
  directory,
  stateDirectory,
}: PromptSource) {
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
  const coordinatorName = sessionName(directory, stateDirectory);
  return {
    scripts,
    systemPrompt: `${skill}\n\n${sessionRules({ coordinator, coordinatorName, scripts })}`,
  } satisfies CommanderPrompt;
});

export { commanderPrompt };
export type { CommanderPrompt, PromptFailure };
