---
title: 技術スタック
description: 主要技術を、初めて読む人向けに説明し、公式・サンプル・記事へつなぐ
---

この節は、主要技術を初めて読む人向けの説明です。採用の優先度は [モダン化計画](/plans/modernization)、部品の置き方は [フロントエンド](/guidelines/frontend)、外に残る状態の宣言は [インフラ](/guidelines/infrastructure) が持ちます。ライブラリの版は `pnpm-workspace.yaml` の catalog が持ち、この節には書きません。

領域ごとの一行の対応は [このテンプレートは何か](/getting-started/what-is-this) にあります。

## ページ

- [TanStack Start](/tech-stack/tanstack-start) — URL と画面、サーバーで行う処理
- [TypeScript](/tech-stack/typescript) — 画面からインフラの宣言までを通す言語
- [Effect](/tech-stack/effect) — 失敗と依存を型に載せる書き方
- [TanStack Query](/tech-stack/tanstack-query) — サーバーのデータをクライアントが共有して読む仕組み
- [Base UI と shadcn](/tech-stack/ui) — 挙動と、リポジトリが持つ見た目の部品
- [Alchemy](/tech-stack/alchemy) — Cloudflare に残る資源の宣言
- [Cloudflare](/tech-stack/cloudflare) — アプリが動く場所と、コードへ渡される binding
