# AGENTS.md

main は高頻度で更新されるので、切りが良いタイミングで都度最新の main を取り込むこと。
`apps/wiki/content/docs` に各種ドキュメントがある。適宜参照する。
アプリケーションコードで表現できない領域について触れる（外部サービスの設定をいじる、デプロイリソースを追加するなど）場合は、まず IaC のみでできないかを徹底的に調査する。
実装したら `.claude/skills/simplify/SKILL.md` に基づいて、サブエージェントにコードレビューを行わせること。
作業を指示された後は、実装・検証が完了して main に merge され、ローカルのリポジトリが更新されるとこまで行い、それがデプロイを伴う場合はデプロイ後にインフラログを見ることまで行うこと。
ファイルを編集する時は必ず gwq を用いて新しい git worktree を作成して、それに EnterWorktree ツールで移動してから行うこと。main ブランチが開いている場所のブランチを変更してはいけない。
main への merge は PR に `ready-to-merge` ラベルを付けて Mergify の merge queue に入れる。
コードの簡潔さや様式より、機械検査による問題検出、実アプリの直接操作による実測データの直接照会を優先する。
動作を確認するときは、agent-browser で実アプリを操作し、その操作に対応する実ログとトレースを、ローカルでは Cloudflare Local Explorer、本番では Workers Observability から直接取得する。
関連アプリ・共通パッケージ・インフラ・内部運用ツールが必要な場合は、他のリポジトリを使用せずこの単一リポジトリの中に追加する。
機能を追加するときは、その機能がどうなったら良い品質なのかという、品質の定義とその観測方法を先に用意する。
テストでは実際のモジュールと実際のDBを使用すること。原則モックは禁止。
外部サービス、外部 HTTP の置換に限り MSW を使用して http レベルのモックを行うこと。
自動検出できる制約を追加するときは、規約の文章は書かずに型レベル, lint, テストなど、機械的にできることで違反を検出する。
ドキュメント・コードコメントは書かない。ドキュメントもコードも、コードを読めば分かるので、生まれた瞬間に矛盾を生み出す要因となるため。何故これをする必要があるのか、という経緯はコミットログに書くこと。

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
