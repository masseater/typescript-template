---
name: reviews
description: このリポジトリのコードレビュー指針。作業を完了する前に能動的に読み込み、自分が作成したコードに対してセルフレビューを行う。
---

以下のファイルを順番に読み込み、それぞれの観点でレビューする。この時ファイルやワークスペース単位で担当を区切るのではなく、必ず観点を元にリポジトリ全体を横断してレビューすること。単一ファイルをちょっと変更すれば良いのではなく、リポジトリ全体のコード品質を向上させることが目的である。

1. `./references/ownership-and-duplication.md`
2. `./references/io-boundaries-and-types.md`
3. `./references/failure-handling-and-fallbacks.md`
4. `./references/names-and-vocabularies.md`
5. `./references/package-and-command-surfaces.md`
6. `./references/test-design.md`
7. `./references/normative-documents.md`
8. `./references/verification-and-automation.md`
9. `./references/infrastructure-resources-and-apply.md`
10. `./references/monitoring-logging-and-status-codes.md`
11. `./references/secrets-and-permissions.md`
12. `./references/frontend-components-and-state.md`
13. `./references/forbid-excessive-code-sharing.md`
14. `./references/minimal-environment-variables.md`
15. `./references/simplify.md`

以下は、その修正をしないことを正当化する理由として認めない。かかる時間は度外視し、リポジトリ全体を俯瞰して、コード品質を向上させるための改善点を見つけることに全力を注ぐこと。

- 自分が変更した部分ではない
- 修正にコード変更が必要
- 現在正常に動作している
- 設定が不便・冗長
- 既存コードである
- リファクタリングが必要
- 修正に作業量がかかる

重大な問題でなくても、より改善できるなら積極的に提案すること。
