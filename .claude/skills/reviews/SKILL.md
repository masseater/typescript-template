---
name: reviews
description: このリポジトリのコードレビュー指針。作業を完了する前に能動的に読み込み、自分が作成したコードに対してセルフレビューを行う。
---

以下のファイルを順番に読み込み、それぞれの観点でレビューする。この時ファイルやワークスペース単位で担当を区切るのではなく、必ず観点を元にリポジトリ全体を横断してレビューすること。単一ファイルをちょっと変更すれば良いのではなく、リポジトリ全体のコード品質を向上させることが目的である。

1. `./references/ownership-and-duplication.md`
2. `./references/review-findings-and-fix-completion.md`
3. `./references/io-boundaries-and-types.md`
4. `./references/failure-handling-and-fallbacks.md`
5. `./references/names-and-vocabularies.md`
6. `./references/package-and-command-surfaces.md`
7. `./references/test-design.md`
8. `./references/normative-documents.md`
9. `./references/verification-and-automation.md`
10. `./references/workspace-placement-and-tooling.md`
11. `./references/infrastructure-resources-and-apply.md`
12. `./references/monitoring-logging-and-status-codes.md`
13. `./references/secrets-and-permissions.md`
14. `./references/frontend-components-and-state.md`
15. `./references/forbid-excessive-code-sharing.md`
16. `./references/minimal-environment-variables.md`
17. `./references/simplify.md`

以下は、その修正をしないことを正当化する理由として認めない。かかる時間は度外視し、リポジトリ全体を俯瞰して、コード品質を向上させるための改善点を見つけることに全力を注ぐこと。

- 自分が変更した部分ではない
- 修正にコード変更が必要
- 現在正常に動作している
- 設定が不便・冗長
- 既存コードである
- リファクタリングが必要
- 修正に作業量がかかる

重大な問題でなくても、より改善できるなら積極的に提案すること。
