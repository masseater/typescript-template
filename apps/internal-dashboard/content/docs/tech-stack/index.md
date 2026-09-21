---
title: 技術スタック
description: 主要技術の形と、公式ドキュメント・サンプル・解説記事への参照
---

画面からインフラまでの技術を、ページごとに書く。版は `pnpm-workspace.yaml` の catalog を見る。ここに写すと、catalog を変えたときから古くなる。部品の置き場所は [フロントエンド](/guidelines/frontend)、資源の宣言の仕方は [インフラ](/guidelines/infrastructure)。領域との対応は [このテンプレートは何か](/getting-started/what-is-this) の表にある。

## ページ

- [TanStack Start](/tech-stack/tanstack-start) — `users.$id.tsx` は `/users/123`
- [TypeScript](/tech-stack/typescript) — `names[0]` は `string | undefined`
- [Vite+](/tech-stack/vite-plus) — コマンドは `vp`
- [Effect](/tech-stack/effect) — `findUser` を書いても、`runPromise` までデータベースは見ない
- [Drizzle](/tech-stack/drizzle) — `sqliteTable` と、D1 の `batch`
- [TanStack Query](/tech-stack/tanstack-query) — `["user", id]` を二つの部品が共有する
- [Base UI と shadcn](/tech-stack/ui) — `disabled` の挙動と、リポジトリに置いた見た目
- [Alchemy](/tech-stack/alchemy) — `Worker(...)` を宣言し、`alchemy plan` で差を見る
- [Cloudflare](/tech-stack/cloudflare) — `env.DB`。応答が終わるとメモリは残らない
