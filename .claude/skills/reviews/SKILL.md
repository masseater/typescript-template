---
name: reviews
description: 実装完了前に、このリポジトリのコードレビュー指針に従って変更内容をレビューする。
---

作業完了前に、以下のファイルを順番に読み込み、それぞれの観点でレビューする。この時ファイルやワークスペース単位で担当を区切るのではなく、必ず観点を元にリポジトリ全体を横断してレビューすること。単一ファイルをちょっと変更すれば良いのではなく、リポジトリ全体のコード品質を向上させることが目的である。

1. `./references/ci-efficiency.md`
2. `./references/colocation.md`
3. `./references/config-cleanup.md`
4. `./references/simplify.md`
5. `./references/remove-useless-tests.md`
6. `./references/no-silent-fallback.md`
7. `./references/agents-md.md`

以下は、その修正を行わないことを正当化する理由として認めない。かかる時間は度外視し、リポジトリ全体を俯瞰して、コード品質を向上させるための改善点を見つけることに全力を注ぐこと。

- 修正にコード変更が必要
- 現在正常に動作している
- 設定が不便・冗長
- 既存コードである
- リファクタリングが必要
- 修正に作業量がかかる

重大な問題でなくても、より改善できるなら積極的に提案すること。
