---
title: Vite+
description: 開発サーバー、検査、テスト、依存関係のインストールを vp に統合したツールチェーン
---

Vite+ は、Vite に検査とタスク実行を統合したツールチェーンである。コマンド名は `vp` である。開発サーバー、ビルド、テスト、lint、フォーマット、モノレポのタスクを、単一の入口から実行する。構成要素は Vite、Rolldown、Vitest、Oxlint、Oxfmt、タスクランナーである。

依存関係の追加は `vp install` で行う。`vp` は、対象プロジェクトのパッケージマネージャを呼び出す。

## 参照

- 公式ドキュメントは [Vite+](https://viteplus.dev/) である。コマンドの一覧は [Getting Started](https://viteplus.dev/guide/)、依存関係のインストールは [Installing Dependencies](https://viteplus.dev/guide/install) に記載される。
- 既存の Vite プロジェクトを Vite+ へ移行する手順は [Migrate to Vite+](https://viteplus.dev/guide/migrate) である。
- 解説記事は [Announcing Vite+](https://voidzero.dev/posts/announcing-vite-plus) と [Announcing Vite+ Beta](https://voidzero.dev/posts/announcing-vite-plus-beta) である。
