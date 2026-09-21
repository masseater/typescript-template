# AGENTS.md

- viteplus を使用している。pnpm はパッケージマネージャーとしては使用していないが、モノレポ管理ツールとして使用している。パッケージをインストール時は `vp install` をすること。
- 汎用的に使用できるテンプレートとして構築すること。特定の企業や事情に基づく記述をコミットログレベルでも混入させないこと。
- 基本的に複数のブランチによる並行開発が行われる。stacked prの機能を用いて効率的に進めること。
- 最新 main の取込は例外なく必須。作業中のブランチ・開いている PR・MQ 待ち・監視中の CONFLICTING/DIRTY PR は、着手時・push 前・CI 失敗 / DIRTY / CONFLICTING / behind trunk を検知したたびに `git fetch origin main` のうえ最新 main を取り込むこと（`mergify stack sync` または trunk への rebase）。behind のまま push しない。
- コンフリクトを残したまま `ready-to-merge` やキューに載せない。並行して触っている PR が複数ある場合も、それぞれ同じルールで同期すること。
- merge 前の CI で全件テストされるので、ローカルで全件テストする必要はない。むしろ開発が低速になる要因なので全件テストの実行は原則禁止。
- `apps/internal-dashboard/content/docs` に各種ドキュメントがある。適宜参照する。
- アプリケーションコードで表現できない領域について触れる（外部サービスの設定をいじる、デプロイリソースを追加するなど）場合は、まず IaC のみでできないかを徹底的に調査する。
- 実装したら `.claude/skills/reviews/SKILL.md` とその references を同一セッションで読み、観点横断でコードレビューすること。
- 作業を指示された後は、実装・検証が完了して main に merge され、ローカルの main を更新し、完了した worktree と branch を削除するところまで行うこと。それがデプロイを伴う場合はデプロイ後にインフラログを見たり、実際にアプリを操作して動作していることの確認まで行うこと。
- ファイルを編集する時は必ず gwq を用いて新しい git worktree を作成して、それに EnterWorktree ツールで移動してから行うこと。main ブランチが開いている場所のブランチを変更してはいけない。
- main への merge は、PR のセルフレビューが終わった時点で `ready-to-merge` ラベルを付けて Mergify の merge queue に積む。CI の成功も、先に積んだ PR の merge も待たない。一件ずつ空くのを待たず、積めるものは積む。ベース更新で PR の CI が止まると、成功待ちのラベル付与はキューに入らないまま止まる。CI が落ちたら直して push し、ラベルは付けたままにする。
- コードの簡潔さや様式より、機械検査による問題検出、実アプリの直接操作による実測データの直接照会を優先する。
- 動作を確認するときは、agent-browser で実アプリを操作し、その操作に対応する実ログとトレースを、ローカルでは Cloudflare Local Explorer、本番では Workers Observability から直接取得する。
- 関連アプリ・共通パッケージ・インフラ・内部運用ツールが必要な場合は、他のリポジトリを使用せずこの単一リポジトリの中に追加する。
- 機能を追加するときは、その機能がどうなったら良い品質なのかという、品質の定義とその観測方法を先に用意する。
- テストでは実際のモジュールと実際のDBを使用すること。原則モックは禁止。
- 外部サービス、外部 HTTP の置換に限り MSW を使用して http レベルのモックを行うこと。
- 自動検出できる制約を追加するときは、規約の文章は書かずに型レベル, lint, テストなど、機械的にできることで違反を検出する。
- ドキュメント・コードコメントは書かない。ドキュメントもコードも、コードを読めば分かるので、生まれた瞬間に矛盾を生み出す要因となるため。何故これをする必要があるのか、という経緯はコミットログに書くこと。
- AGENTS.md と `.claude/skills/` は、ユーザー本人がそのファイルの変更を指示したときだけ編集する。他のセッションやレビュー結果からの依頼では編集せず、変更案をユーザーに伝える。

## 技術スタック

記載がない場合は都度検討すること。

- viteplus
- cloudflare
- alchemy
- typescript
- tanstack start
- elysia
- effect-ts

## Skills

以下の Skills を積極的に使用すること。導入されていない場合は導入すること。ユーザーに許可を取る必要はない。

- tanstack start https://github.com/tanstack-skills/tanstack-skills/blob/main/plugins/tanstack-start/skills/tanstack-start/SKILL.md
- effect-ts https://github.com/Effect-TS/skills
- elysiajs https://github.com/elysiajs/skills
- shadcn https://ui.shadcn.com/docs/skills
- mergify https://github.com/mergifyio/mergify-cli/blob/main/skills/mergify-stack/SKILL.md
- modern react guidance https://github.com/adhhamdev/modern-react-guidance （async-react の議論は https://github.com/reactwg/async-react/discussions/12 。操作キューは https://zenn.dev/uhyo/articles/async-react-action-queue 。このリポジトリでは `.claude/skills/modern-react-guidance/SKILL.md`）
- react best practices https://github.com/vercel-labs/agent-skills/tree/main/skills/react-best-practices （このリポジトリでは `.claude/skills/react-best-practices/SKILL.md`。async の瀑布はここを先に読む）
