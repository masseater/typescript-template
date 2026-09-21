---
title: Cloudflare
description: アプリケーションを Workers として実行し、外部依存を binding として渡す
---

データベースは、接続文字列ではなく `env.DB` で渡される。

```ts
export default {
  async fetch(_request, env) {
    const row = await env.DB.prepare("select name from user where id = ?").bind("123").first();
    return Response.json(row);
  },
};
```

常駐するプロセスはない。リクエストが来たときに `fetch` が動き、応答を返したあとのメモリは残らない。開発時も本番と同じ workerd で動く。

`env.DB` の実体は D1 で、中身は SQLite である。接続先をソースに書くと、宣言を変えてもその文字列は古いまま残る。`DB` を宣言へ書くのは [Alchemy](/tech-stack/alchemy) である。

部屋ごとのチャットのように、リクエストをまたいで同じ状態を触るときは Durable Objects を使う。部屋の id ごとにオブジェクトが一つあり、そのオブジェクトが接続とメッセージを持つ。`fetch` が終わると消えるメモリには、その状態は置けない。

## 参考文献

- 公式 — [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- 公式 — [How Workers works](https://developers.cloudflare.com/workers/reference/how-workers-works/)
- 公式 — [Bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/)
- 公式 — [D1](https://developers.cloudflare.com/d1/)
- 公式 — [Durable Objects](https://developers.cloudflare.com/durable-objects/)
- 公式 — [Workers Observability](https://developers.cloudflare.com/workers/observability/)
- 公式 — [Local development](https://developers.cloudflare.com/workers/local-development/)
- サンプル — [start-basic-cloudflare](https://github.com/TanStack/router/tree/main/examples/react/start-basic-cloudflare)
- 記事 — [Introducing D1](https://blog.cloudflare.com/introducing-d1/)
- 記事 — [SQLite in Durable Objects](https://blog.cloudflare.com/sqlite-in-durable-objects/)
