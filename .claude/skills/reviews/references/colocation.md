---
name: colocation
description: コロケーションの観点から変更をレビューし、関連性・所有関係・変更単位に基づいた自然な配置と依存境界を維持する。
---

リポジトリの構造が関連性・所有関係・変更単 を適切に表しているかレビューする。

- 同じfeature・責務に属するものは近くに置く。
- 一緒に変更・理解されるものは近くに置く。
- feature固有のコード、型、utility、定数、hook、テスト、設定、ドキュメントなどは、そのfeatureの近くに置く。
- `shared` / `common` / グローバルな場所へ置くのは、本当に共有されるものに限る。
- 将来使うかもしれない、という理由だけで抽象化・共有化しない。
- 既存のリポジトリの構成・規約を優先する。
- feature / package の境界は明確にし、内部実装を境界の外から直接利用しない。
- ImportLintでpackage内部への直接importを防ぎ、dependency-cruiserでpackage / feature間の依存方向を制約する。
- 境界を守るために、lintの無効化や不要な例外を追加しない。

重大な問題でなくても、より自然な配置にできるなら改善案として提案してよい。

レビュー対象の変更作業に必要な労力・時間・差分量は、コロケーションの判断材料にしない。

移動やリファクタリングの作業量が大きいことを理由に、指摘を省略・弱めてはいけない。

## References

- ImportLint: https://github.com/uhyo/import-lint
- dependency-cruiser: https://github.com/sverweij/dependency-cruiser
