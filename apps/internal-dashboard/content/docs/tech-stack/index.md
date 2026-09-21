---
title: 技術スタック
description: 主要技術の定義と、公式ドキュメント・サンプル・解説記事への参照
---

各ページは、一つの技術の定義と、公式ドキュメント、サンプル、解説記事からなる。部品をどこに置くかは [フロントエンド](/guidelines/frontend)、外部に残る状態をどう宣言するかは [インフラ](/guidelines/infrastructure) が定める。ライブラリの版をここに写すと catalog とずれるため、版は `pnpm-workspace.yaml` の catalog だけが持つ。

どの領域にどの技術を対応させるかは、[このテンプレートは何か](/getting-started/what-is-this) の表にある。

## ページ

- [TanStack Start](/tech-stack/tanstack-start) — URL と画面、サーバーで実行する処理
- [TypeScript](/tech-stack/typescript) — 画面からインフラの宣言までを同じ型検査の対象にする言語
- [Vite+](/tech-stack/vite-plus) — 開発、検査、テスト、依存関係のインストールを一つのコマンド `vp` にまとめたツールチェーン
- [Effect](/tech-stack/effect) — 成功、失敗、必要なサービスを型に持つ記述を、入口で実行するライブラリ
- [Drizzle](/tech-stack/drizzle) — SQLite のテーブル定義とクエリ
- [TanStack Query](/tech-stack/tanstack-query) — 表示後の取得結果を、クライアントがキーごとに共有するライブラリ
- [Base UI と shadcn](/tech-stack/ui) — 挙動と、リポジトリ内に保持する見た目の部品
- [Alchemy](/tech-stack/alchemy) — Cloudflare 上に残る資源の宣言
- [Cloudflare](/tech-stack/cloudflare) — アプリケーションの実行環境と binding
