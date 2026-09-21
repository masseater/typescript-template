---
title: 技術スタック
description: 主要技術の働きと、公式ドキュメント・サンプル・解説記事への参照
---

この節が持つのは、各技術の働きと、公式ドキュメント・サンプル・記事へのリンクである。版は `pnpm-workspace.yaml` の catalog が持つので、ここには書かない。部品をどこに置くかは [フロントエンド](/guidelines/frontend)、資源をどう宣言するかは [インフラ](/guidelines/infrastructure) が持つ。どの領域に何を置くかは [このテンプレートは何か](/getting-started/what-is-this) の表にある。

## ページ

- [TanStack Start](/tech-stack/tanstack-start) — ファイル経路、loader、server function
- [TypeScript](/tech-stack/typescript) — 添字、optional property、`import type`
- [Vite+](/tech-stack/vite-plus) — `vp`
- [Effect](/tech-stack/effect) — `Effect.fn`、Schema、Atom
- [Drizzle](/tech-stack/drizzle) — `sqliteTable`、マイグレーション、D1 の `batch`
- [TanStack Query](/tech-stack/tanstack-query) — `queryOptions` と `useQuery`
- [Base UI と shadcn](/tech-stack/ui) — 挙動と、リポジトリ内の部品
- [Alchemy](/tech-stack/alchemy) — 資源の宣言と `alchemy plan`
- [Cloudflare](/tech-stack/cloudflare) — Workers、binding、D1、Durable Objects
