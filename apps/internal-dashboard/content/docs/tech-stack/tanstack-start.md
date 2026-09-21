---
title: TanStack Start
description: URL を画面に対応させ、初期データとサーバー専用の処理を扱うフレームワーク
---

TanStack Start は、React の画面と、その画面のためにサーバーで行う処理を、一つのフレームワークとして書く。実行環境は Cloudflare Workers で、開発時も本番と同じ実行系（workerd）で動作する。

経路はファイルの配置から決まる。ファイル名が URL の区間になり、名前がアンダースコアで始まる区間は URL に含まれないレイアウトになる。

loader は、その URL へ遷移するときにサーバーで実行され、画面の初期データを返す。表示が終わったあとの再取得や、部品のあいだでの共有はしない。

server function は `createServerFn` で定義する。クライアントから呼び出せるが、本体が実行されるのはサーバーだけである。呼び出しの手続きはこのアプリケーションのクライアント向けであり、外部のクライアントが HTTP として契約する API ではない。外部からの呼び出しを受けるときは、サーバールートを使う。

表示後にクライアントがデータを保持し、再取得し、同じキーの部品のあいだで共有する機構は [TanStack Query](/tech-stack/tanstack-query) である。

## 参考文献

- 公式 — [TanStack Start](https://tanstack.com/start/latest)
- 公式 — [Overview](https://tanstack.com/start/latest/docs/framework/react/overview)
- 公式 — [Server Functions](https://tanstack.com/start/latest/docs/framework/react/guide/server-functions)
- 公式 — [Hosting](https://tanstack.com/start/latest/docs/framework/react/guide/hosting)
- 公式 — [TanStack Start · Cloudflare Workers](https://developers.cloudflare.com/workers/framework-guides/web-apps/tanstack-start/)
- サンプル — [start-basic-cloudflare](https://github.com/TanStack/router/tree/main/examples/react/start-basic-cloudflare)
- 記事 — [TanStack Start v1 Release Candidate](https://tanstack.com/blog/announcing-tanstack-start-v1)
- 記事 — [Why choose TanStack Start and Router?](https://tanstack.com/blog/why-tanstack-start-and-router)
