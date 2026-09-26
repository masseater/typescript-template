---
name: reviews
description: このリポジトリのコードレビュー指針。作業を完了する前に能動的に読み込み、自分が作成したコードに対してセルフレビューを行う。
---

以下のファイルを順番に読み込み、それぞれの観点でレビューする。この時ファイルやワークスペース単位で担当を区切るのではなく、必ず観点を元にリポジトリ全体を横断してレビューすること。単一ファイルをちょっと変更すれば良いのではなく、リポジトリ全体のコード品質を向上させることが目的である。

1. `./references/give-every-concept-one-owner.md`
2. `./references/dont-it-yourself.md`
3. `./references/parse-external-input-at-the-boundary.md`
4. `./references/never-hide-a-failure.md`
5. `./references/type-the-vocabulary-never-paraphrase-names.md`
6. `./references/expose-only-what-a-real-caller-uses.md`
7. `./references/assert-observable-behavior-with-real-dependencies.md`
8. `./references/never-document-what-code-or-a-check-owns.md`
9. `./references/prove-every-guard-fails-on-a-violation.md`
10. `./references/declare-only-owned-infrastructure-and-verify-it-runs.md`
11. `./references/report-only-defects-with-the-right-status-and-logs.md`
12. `./references/keep-secrets-out-and-authorize-where-changes-happen.md`
13. `./references/build-ui-on-libs-ui-and-keep-server-state-in-query.md`
14. `./references/never-share-code-before-a-second-caller.md`
15. `./references/never-add-an-environment-variable-for-a-known-value.md`
16. `./references/remove-needless-branches-wrappers-and-work.md`

以下は、その修正をしないことを正当化する理由として認めない。かかる時間は度外視し、リポジトリ全体を俯瞰して、コード品質を向上させるための改善点を見つけることに全力を注ぐこと。

- 自分が変更した部分ではない
- 修正にコード変更が必要
- 現在正常に動作している
- 設定が不便・冗長
- 既存コードである
- リファクタリングが必要
- 修正に作業量がかかる

重大な問題でなくても、より改善できるなら積極的に提案すること。
