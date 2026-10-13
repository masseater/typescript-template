<!-- intent-skills:start -->
## Skill Loading

Use the repository’s installed Intent. If it is unavailable, report the missing dependency instead of downloading a replacement.
Before editing files for a substantial task:
- Run `pnpm exec intent list` from the workspace root to see available local skills.
- If a listed skill matches the task, run `pnpm exec intent load <package>#<skill>` before changing files.
- Use the loaded `SKILL.md` guidance while making the change.
- Monorepos: when working across packages, run the skill check from the workspace root and prefer the local skill for the package being changed.
- Multiple matches: prefer the most specific local skill for the package or concern you are changing; load additional skills only when the task spans multiple packages or concerns.
<!-- intent-skills:end -->

<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, and it invokes Vite through `vp dev` and `vp build`. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

Docs are local at `node_modules/vite-plus/docs` or online at https://viteplus.dev/guide/.

## Built-in Commands vs Scripts

`vp <name>` runs a built-in command. `vp run <name>` runs a `package.json` script or a `vite.config.ts` task. Scripts cannot overwrite built-ins, so `vp dev` and `vp run dev` may do different things. Check `package.json` and `vite.config.ts` first, and run `vp run <name>` when the project defines a script or task with that name.

## Tool Versions

Run `vp toolchain` to show versions and relationships in the active Vite+
release. Add a tool name to select part of the graph. For example, run
`vp toolchain vite`. Use `--global` to ignore the local `vite-plus` package. Use
`vp why <package>` to show the package-manager dependency graph.

## Review Checklist

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to format, lint, type check and test changes.
- [ ] Check if there are `vite.config.ts` tasks or `package.json` scripts necessary for validation, run via `vp run <script>`.
- [ ] If setup, runtime, or package-manager behavior looks wrong, run `vp env doctor` and include its output when asking for help.

<!--VITE PLUS END-->

## 環境変数と認証

- 環境変数は、本当に環境ごとに変わる値だけにする。変わらない値はコードか Alchemy の設定に書き、ツールにフラグがあればフラグを使う。
- クラウドの認証は Alchemy のプロファイルで管理する。

## Cloudflare

- Workers Paid プランを前提に設計してよい。
- ゾーンの WAF カスタムルールは 1 ゾーンにつき 1 スタックだけが持つ。持ち主のリポだけが `OWNED_ZONE` にゾーン名を入れる。今の持ち主は masseater.dev ゾーンの masseater/masseater.dev で、Logpush のジョブとバケットもそこが持つ。
- Worker にはすべて `logpush: true` を付ける。
- Bot Fight Mode は正当な自動アクセスまで止めるので使わない。

## ライブラリの型

- ライブラリが型を提供する値は `Schema.decodeUnknown*` で受けて型を捨てない。ライブラリの型のまま `Schema.decode*` に渡す。
- ライブラリが export する型・スキーマ・enum・定数を書き写さない。一部だけ使うときも `Pick` などで作る。

## 外部 API クライアント

手で包まず、Effect 公式のパッケージ（https://github.com/Effect-TS/effect#packages ）、distilled.cloud の Effect 定義（Cloudflare は `@distilled.cloud/cloudflare`）、公開 OpenAPI からの `@effect/openapi-generator` 生成、の順に選ぶ。

## レビューとCI

- PR のレビューも PR ごとの CI・動作検証・デプロイもしない。動作は main からデプロイされた本番で確かめる。
- PR のタイトルと本文は、後でエージェントが検索して引っかかる程度でよい。
- マージ前に必ず base を取り込み、手元の `vp run verify` を通してから自分でマージする。マージしてよいかは聞かない。ルールセットのバイパスや `--admin` は使わない。
- CI は main への push で `.github/workflows/verify.yml` が走らせる。デプロイやリリースのジョブは同じワークフローで `needs: verify` にする。
- release-please のリリース PR は、Claude が `verify` を手動実行して作り直す。`up-to-date` が承認待ちのまま取り込むものも無ければ、ユーザーに承認を頼む。

## oxlint-plugin-decision

- 文章で書く lint ルールは `decision-rules.ts` に書く。
- 無料の `openrouter/respan/span-01-lite` で判定できないルールだけを有料の decider で判定する。判定できるかは、正解の分かる違反例と違反でない例を、キャッシュを消して `OXLINT_DECISION_EXPLAIN=json` で判定させて確かめる。
- ルールが使うモデルは、ユーザーの指示なしに変えない。

## 計測

- 推測するな、計測しろ。実装や修正の前に計測で事実を確かめ、その結果だけで判断する。手元やテスト環境だけの計測は根拠にしない。
- 機能開発の前に、AI が自分でデバッグできる仕組み（再現手段、ログやスパン、それを読む経路）を作る。
- 時間かお金を使う処理はすべてスパンにする。Workers 以外のプロセスは Effect 公式の `OtlpTracer.layerFromConfig` を使う。計測のためだけにコマンドやプロセスを包まない。
- ワークフローを足したら、最後に `.github/scripts/ci-telemetry.sh` を動かすジョブを置く。
- 手順は `measure-dont-guess`、不具合の調査は `systematic-debugging`、完了の確認は `verification-before-completion` スキルに従う。

## 脆弱性

- ZAP のアラートは警告を含めすぐ直す。誤検知だけを `.github/zap/rules.tsv` に書く。
- `audit` が落ちたら `vp pm audit --fix` で直す。修正版の無い勧告だけを `auditConfig.ignoreGhsas` に載せ、理由をコミットメッセージに書く。

## 公開先

- デプロイ先や外部公開しているもの（サイト、API、npm パッケージなど）があれば、その URL を README に一覧で載せる。

## スキルとベース

- 複数リポで使う自作スキルは https://github.com/masseater/skills に置き、skills CLI で入れる。リポにコピーしない。
- このリポジトリのベースは https://github.com/masseater/typescript-template である。
