---
title: Elysia
description: ブラウザ以外からも呼ぶ HTTP API を、型付きのクライアントと対にして置くルーター
---

Elysia は、ブラウザ以外からも呼ぶ HTTP API のルーターである。[TanStack Start](/tech-stack/tanstack-start) の `createServerFn` は URL にならない。外向けの入口は Elysia で、`/api/$` のサーバールートが受け取った `Request` を `app.fetch` に渡す。

```ts
const Route = createFileRoute("/api/$")({
  server: elysiaServer(app),
});
```

インスタンスは `createApi` が作る。Workers では `CloudflareAdapter` を付け、プレフィックスは `/api` である。ルートの処理は Elysia のハンドラへ async で書かず、[Effect](/tech-stack/effect) を渡す。応答のスキーマと、失敗のタグに対応するステータスは、そのルートに付ける。

```ts
createApi("/api").post("/contact", api.route(ContactAccepted, submitContact, failures));
```

`submitContact` は `Request` を受けて Effect を返す。JSON の検証は [Effect](/tech-stack/effect) の Schema で、ハンドラの中で行う。分割したアプリは `createApi("")` で作り、プレフィックスを持つ親が `.use` する。

呼び出す側の型は、このアプリの型から Eden Treaty が出す。サーバーでは `treaty(app)` とし、HTTP を介さずそのインスタンスを呼ぶ。ブラウザでは `treaty<App>(origin)` とし、同じ経路を HTTP で呼ぶ。経路の型を別の仕様として書かない。

## 参考文献

- 公式 — [Elysia](https://elysiajs.com/)
- 公式 — [Route](https://elysiajs.com/essential/route.html)
- 公式 — [Eden](https://elysiajs.com/eden/overview.html)
- 公式 — [Treaty](https://elysiajs.com/eden/treaty/overview.html)
- 公式 — [Cloudflare Worker](https://elysiajs.com/integrations/cloudflare-worker.html)
- 公式 — [At a glance](https://elysiajs.com/at-glance)
- サンプル — [elysiajs/elysia](https://github.com/elysiajs/elysia)
- 記事 — [Elysia 1.0](https://elysiajs.com/blog/elysia-10)
- 記事 — [Elysia 1.2](https://elysiajs.com/blog/elysia-12)
