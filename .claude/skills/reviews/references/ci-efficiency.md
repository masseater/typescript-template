---
name: ci-efficiency
description: CIの実行時間と実行量を削減する。CIの高速化、テスト対象の最適化、キャッシュ、merge queueの活用を行うときに使用する。
---

# CI Efficiency

CIは、不要な処理を実行しないことを最優先にして効率化する。

- `.github/workflows` の `paths` / `paths-ignore` による変更ファイル単位のCIフィルタは使わない。
- リポジトリに導入されている `viteplus` / `pnpm` / `nx` を使い、依存関係やtask graphから変更・影響範囲を求める。
- PRでは、変更・影響を受ける範囲のlint、typecheck、test、buildだけを実行する。
- PRごとにリポジトリ全体のテストや重い統合テストを実行しない。
- task cache、dependency cache、remote cacheなどを活用し、同じ処理を繰り返さない。
- 独立したtaskは並列化する。
- PR CIとmerge queue CIで同じ重いテストを重複実行しない。
- 重要なintegration test、E2E、全体回帰テストなどは、merge queue後の統合済みコードに対するCIで実行する。
- merge queueで重要なテストを必須チェックにできる構成を優先する。
- CIを速くするためだけにテスト対象を削らない。変更による影響範囲を正しく保ったまま実行量を減らす。
- 変更後はCIの実行時間だけでなく、実行task数とcache hit率も確認する。
