---
title: Cloudflare
description: アプリケーションを Workers として実行し、外部依存を binding として渡す
---

実行環境は Cloudflare Workers である。リクエストを待っているプロセスは無く、`fetch` が応答を返したあとのメモリは残らない。開発時も同じ workerd で動く。資源の記述は [Alchemy](/tech-stack/alchemy) が持つ。

Worker の外にあるデータベースは、接続文字列ではなく binding で渡す。D1 はその binding の先にある SQLite である。接続先をソースに書くと、宣言を変えても文字列の側は変わらない。

```ts
export default {
  async fetch(_request, env) {
    const row = await env.DB.prepare("select name from user where id = ?").bind(id).first();
    return Response.json(row);
  },
};
```

同じ id へのアクセスを同じオブジェクトへ届け、リクエストが終わったあともそのオブジェクトが状態を持つときは Durable Objects を使う。`fetch` のローカル変数には、その状態は残せない。

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
