作業を始める前に `repo-conventions` と `vite-plus` の skill を読み、従う。どちらも masseater/skills にあり、`vp install` が `.agents/skills/` に入れる。

## コマンド

- `vp run verify` が検査をまとめて流す。pre-push フックと Stop フックも同じ verify を走らせる。
- テストを 1 つだけ走らせるときは、`apps/web` で `vp test run <ファイル>` を実行する。
- D1 のスキーマは `*.table.ts` に書き、`apps/web` で `vp run db:generate` を実行してマイグレーションを作る。better-auth のテーブルは `vp run auth:generate` で生成する。

## 構成

- `apps/web` は TanStack Start のアプリである。`alchemy.run.ts` が D1 と Worker を定義し、Cloudflare にデプロイする。`apps/web/app-name.ts` の `APP_NAME` を変えるとリソースは作り直される。
- API は Elysia で書く。`src/app/routes/api.$.ts` が `/api/*` を `src/app/server/api.server.ts` のルーターへ渡し、各スライスのルートは `index.server.ts` からそこへ足す。
- クライアントは `shared/api` で Eden の型から TanStack Query のクエリを作る。SSR 中は `createIsomorphicFn` がルートの `handle` を直接呼ぶ。
- `apps/lp` は静的な LP の見本で、`apps/web` のスタックが `Website.StaticSite` でデプロイする。誰にでも見せる静的なページはこの形で作る。
