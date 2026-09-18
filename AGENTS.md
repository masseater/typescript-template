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

## タスク

作業は GitHub の Issue で管理し、順序は Issue の blocked by で表す。状態の正本は Issue で、下の表は 2026-09-18 に並列セッションを棚卸しした時点の対応表である。

- 着手できるのは、open で、blocked by が全て closed の Issue だけ。`gh issue view <番号> --json state,blockedBy` で確かめる。
- 1 つの Issue を main への merge まで終えてから次へ進む。複数の PR を同時に merge queue へ入れない。全ファイルを横断する PR が、queue を待つ間に main が進むたびに衝突し直すため（#70 は 11 回、#75 は 7 回取り込み直した）。
- 再開するときは Issue 本文の「引き継ぎ状態」を読み、表の branch と worktree をそのまま使う。同じ目的の branch を作り直さない。
- PR の本文に `Closes #<Issue 番号>` を入れる。
- conflict の解消で相手側の変更を捨てない。改名や再整形のような機械的な変更は、main 側を採用してから同じ機械的な変更を掛け直す。
- `eslint/no-restricted-imports` は使わない。import の禁止は `project/boundaries` と `tools/quality/retired-packages.ts` で表す。
- 新しいタスクが見つかったら Issue を作り、blocked by を設定してから表に足す。終わった行は表から消す。

worktree は `/Users/u1/ghq/github.com/masseater/` からの相対パス。

### 進行中の作業がある Issue

| Issue | タスク                                                                                       | PR     | branch                          | worktree                                            | blocked by     | 2026-09-18 の状態                                                                                                             |
| ----- | -------------------------------------------------------------------------------------------- | ------ | ------------------------------- | --------------------------------------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| #108  | react-doctor を `vp run check` に加える                                                      | #89    | `chore/react-doctor`            | `typescript-template=chore-react-doctor`            | なし           | `ready-to-merge` 済み、queue 待ち                                                                                             |
| #110  | import・Tailwind クラス・package.json の並びを oxfmt に任せ、UI 部品を jsx-a11y の対象にする | #70    | `chore/fmt-sort-a11y`           | `typescript-template-fmt-sort`                      | #108           | 実装完了、CONFLICTING。約 490 ファイルを再整形する                                                                            |
| #109  | Mergify CLI を mise で固定する                                                               | #104   | `chore/mise-mergify-cli`        | `typescript-template=chore-mise-mergify-cli`        | #110           | 実装完了、check 通過                                                                                                          |
| #111  | runtime_unavailable のログに失敗の原因を載せる                                               | #85    | `fix/runtime-unavailable-cause` | `typescript-template=fix-runtime-unavailable-cause` | #110           | 再レビュー中                                                                                                                  |
| #112  | Effect の span・ログと Workers のトレースを OTLP で送る                                      | #66    | `feat/otlp`                     | `typescript-template=feat-otlp`                     | #110           | レビュー中                                                                                                                    |
| #113  | 送信ドメインの Email Service への onboard を Alchemy の宣言に入れる                          | #60    | `feat/email-sending`            | `typescript-template=feat-email-sending`            | #110           | 再レビュー中                                                                                                                  |
| #115  | Scalar の API リファレンスを contract から導出する                                           | #88    | `feat/scalar`                   | `typescript-template=feat-scalar`                   | #110           | レビューの must 2 件を修正中                                                                                                  |
| #116  | TanStack Query / DB / Virtual / Form / Pacer / Devtools を user アプリと共有フォームに入れる | #87    | `feat/tanstack-user`            | `typescript-template=feat-tanstack-user`            | #110           | レビュー中                                                                                                                    |
| #117  | UI 状態を Effect Atom に統一し、他の状態管理手段を禁止する                                   | #100   | `feat/effect-atom`              | `typescript-template=feat-effect-atom`              | #116           | 実装完了。#87 が持ち込む useState 類を Atom に揃える作業が残る                                                                |
| #118  | サーバーデータの読み込みを TanStack Query に移し、atom でサーバーデータを持つことを禁止する  | なし   | `feat/tanstack-query`           | `typescript-template=feat-tanstack-query`           | #116 #117      | 移行はローカル commit 済み。#87 の設計に揃える作り直しが残る                                                                  |
| #120  | k6 でローカルの Worker に負荷を掛け、しきい値で判定する                                      | #55    | `chore/k6-load-test`            | `typescript-template=chore-k6-load-test`            | #110           | レビューの must 1 件に対応中                                                                                                  |
| #121  | ミューテーションテストでテストの検出力を測る                                                 | #53    | `chore/stryker`                 | `typescript-template=chore-stryker`                 | #120           | CONFLICTING                                                                                                                   |
| #122  | import の境界を dependency-cruiser で判定する                                                | #51    | `chore/dependency-cruiser`      | `typescript-template=chore-dependency-cruiser`      | #121 #117 #118 | CONFLICTING。`tools/quality/import-boundaries.ts` を削除するので、#117 と #118 が同じファイルに足したルールを移してから入れる |
| #123  | vp の実行と git hooks を OpenTelemetry で計測する                                            | 作成中 | `perf/vp-otel`                  | `typescript-template=perf-vp-otel`                  | #110           | 実装完了、push 中                                                                                                             |
| #125  | D1 の自前マイグレーションを drizzle migrator に置き換える                                    | なし   | `worktree-d1-drizzle-migrator`  | `typescript-template=worktree-d1-drizzle-migrator`  | #110           | 実装ほぼ完了、テスト書き換え中                                                                                                |
| #128  | masseater/mst の 5 ツールを `tools/` に取り込む                                              | なし   | `feat/mst-tools`                | `typescript-template=feat-mst-tools`                | #110           | 取り込み済みだが、同じ branch に #129 と #130 の変更が混ざっている。3 つの PR に切り分ける                                    |
| #145  | 役目を終えた worktree と branch を片付ける                                                   | なし   | なし                            | なし                                                | なし           | 対象は Issue に列挙                                                                                                           |

### 未着手の Issue

| Issue | タスク                                                                                    | blocked by                    |
| ----- | ----------------------------------------------------------------------------------------- | ----------------------------- |
| #114  | email unit を本番へ deploy し、サインアップを実測して bootstrap:remote まで行う           | #113                          |
| #144  | CI からデプロイし、デプロイ用トークンの扱いを決める                                       | #114                          |
| #126  | 1 つのアプリからしか使われていない libs をそのアプリへ移す                                | #111 #112 #113 #115 #118 #125 |
| #127  | Node 組み込みモジュールの利用を Effect platform API に置き換える                          | #126 #123                     |
| #129  | dont-review-it のプリセットに準拠するようコードを書き換える                               | #128 #127 #122                |
| #130  | ルート lint を dont-review-it のプリセット一系統に切り替える                              | #129                          |
| #119  | admin の表を TanStack Table v9 に載せる                                                   | #118 #130                     |
| #139  | Paraglide JS で i18n を入れる                                                             | #118 #119                     |
| #140  | `@smarthr/wareki` と `temporal-polyfill` を入れる                                         | #118 #130                     |
| #141  | Motion でアニメーションを入れる                                                           | #118 #130                     |
| #142  | 和文フォントのフォールバックを揃える                                                      | #130                          |
| #143  | Vitest browser mode と Playwright でアプリ全体の E2E を走らせる                           | #118 #130                     |
| #124  | vp の計測結果から性能を改善し、再計測で効果を確かめる                                     | #123 #130                     |
| #131  | effect-cf で Cloudflare の binding を Effect の Layer として扱う                          | #112 #113 #130                |
| #132  | Durable Objects でユーザー単位の状態を持ち、WebSocket で配信する                          | #131                          |
| #133  | Cloudflare Flagship と OpenFeature の SDK でフィーチャーフラグを評価する                  | #131 #118                     |
| #134  | Queues で非同期処理のキューを持つ                                                         | #131                          |
| #135  | Cloudflare Workflows V2 で再開可能な多段処理を持つ                                        | #131 #134                     |
| #136  | R2 にファイルを保存する                                                                   | #131                          |
| #137  | KV で読み込みの多いデータをキャッシュする                                                 | #131                          |
| #138  | Containers にネイティブ依存の処理を逃がす。課金が発生しうるので着手前にユーザーへ確認する | #131                          |
| #146  | 計画書の状況を main に合わせ、全体を simplify して完了を確認する                          | 上の全 Issue                  |

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
