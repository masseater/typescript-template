---
title: 技術スタック
description: 主要技術の定義と、公式ドキュメント・サンプル・解説記事への参照
---

この節は、主要技術の定義と、公式ドキュメント・サンプル・解説記事への参照を記載する。部品の配置に関する判断は [フロントエンド](/guidelines/frontend)、外部に残る状態の宣言に関する判断は [インフラ](/guidelines/infrastructure) が持つ。ライブラリの版は `pnpm-workspace.yaml` の catalog が持ち、この節には記載しない。

領域と採用技術の対応は [このテンプレートは何か](/getting-started/what-is-this) に記載する。

## ページ

- [TanStack Start](/tech-stack/tanstack-start) — URL と画面、サーバーで実行する処理
- [TypeScript](/tech-stack/typescript) — 画面からインフラの宣言までを通す言語
- [Vite+](/tech-stack/vite-plus) — 開発、検査、テスト、依存関係のインストールを統合する `vp`
- [Effect](/tech-stack/effect) — 失敗と依存を型に含めて、入口で実行するモデル
- [Drizzle](/tech-stack/drizzle) — SQLite のテーブル定義とクエリ
- [TanStack Query](/tech-stack/tanstack-query) — サーバー上のデータをクライアントが共有して取得する機構
- [Base UI と shadcn](/tech-stack/ui) — 挙動と、リポジトリ内に保持する見た目の部品
- [Alchemy](/tech-stack/alchemy) — Cloudflare 上に残る資源の宣言
- [Cloudflare](/tech-stack/cloudflare) — アプリケーションの実行環境と binding
