---
title: Vite+
description: 開発サーバー、検査、テスト、依存のインストールを vp にまとめたツールチェーン
---

Vite+ は、Vite そのものではなく、その上に検査とタスクをまとめたツールチェーンです。コマンドは `vp` です。開発サーバー、ビルド、テスト、lint、フォーマット、モノレポのタスクが、別々のツールを自分で繋がなくても同じ入口から走ります。中身は Vite、Rolldown、Vitest、Oxlint、Oxfmt、タスクランナーです。

パッケージマネージャは pnpm のワークスペースのままです。依存を足したり入れたりするコマンドは `pnpm add` ではなく `vp install` です。`vp` が、そのワークスペースの pnpm を呼びます。

## 公式と読みもの

- 公式は [Vite+](https://viteplus.dev/) です。コマンドの全体は [Getting Started](https://viteplus.dev/guide/)、依存の入れ方は [Installing Dependencies](https://viteplus.dev/guide/install) にあります。
- 既存の Vite プロジェクトを移す手順は [Migrate to Vite+](https://viteplus.dev/guide/migrate) です。
- 何を 1 つにまとめたかは [Announcing Vite+](https://voidzero.dev/posts/announcing-vite-plus) と [Announcing Vite+ Beta](https://voidzero.dev/posts/announcing-vite-plus-beta) にあります。
