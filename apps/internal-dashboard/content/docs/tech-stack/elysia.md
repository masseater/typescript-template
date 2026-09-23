---
title: Elysia
description: URL を持つ HTTP API のルーター。ハンドラは Effect で、呼び出し側の型は Eden Treaty が出す
---

Elysia は HTTP のルーターである。URL とメソッドをインスタンスに登録し、来た `Request` は `app.fetch` が受ける。[TanStack Start](/tech-stack/tanstack-start) の `createServerFn` は URL を持たない。URL として置く API は Elysia に置き、Workers の fetch 自体は Start が持つ。`/api/$` のサーバールートが、受け取った `Request` を渡す。

```ts
const Route = createFileRoute("/api/$")({
  server: elysiaServer(app),
});
```

`ANY` は `app.fetch` を呼ぶ。`HEAD` は、応答が `text/event-stream` のとき本体を読まず、それ以外では `content-length` を付けてヘッダだけ返す。

インスタンスは `createApi(prefix)` が作る。Workers 向けに `CloudflareAdapter` を付ける。ボディは Elysia に読ませず未読のまま残し、ハンドラが `readJsonBody` で Origin を確認してから [Effect](/tech-stack/effect) の Schema でデコードする。一致する URL が無いときは 404 で、本体は `{ error }` である。

処理は Effect として `routes.route` に渡す。`routes` は実行時に Effect を実行する登録口で、成功の値を第一引数のスキーマで符号化し、タグ付きの失敗を第三引数の表にあるステータスにする。JSON がスキーマを満たさないときの `InputInvalid` や、セッション不足のような共通の失敗は、この表には書かない。

```ts
import { Effect, Schema } from "effect";

const ContactSubmission = Schema.Struct({
  email: Schema.String,
  message: Schema.String,
});
const ContactAccepted = Schema.Struct({ ok: Schema.Literal(true) });

class MessageTooLong extends Schema.TaggedError<MessageTooLong>()("MessageTooLong", {}) {}

const failures = {
  MessageTooLong: { message: "本文が長すぎます。", status: 400 },
};

const submitContact = Effect.fn("contact.submit")(function* (request: Request) {
  const submission = yield* readJsonBody(ContactSubmission, request);
  if (submission.message.length > 2000) {
    return yield* new MessageTooLong();
  }
  return { ok: true as const };
});

const app = createApi("/api").post(
  "/contact",
  routes.route(ContactAccepted, submitContact, failures),
);
```

`submitContact(request)` は Effect を返すだけで、この時点では `readJsonBody` は呼ばれない。`POST /api/contact` を受けた `routes.route` がそれを実行する。スキーマを満たさない JSON は `InputInvalid` になり、2000 字を超える本文は表の `MessageTooLong` として 400 になる。通った `{ ok: true }` は `ContactAccepted` で符号化してから返す。

URL をファイルで分けるときは、子を `createApi("")` で作り、プレフィックス `/api` の親が `.use` する。子には `/api` を書かない。`createApi("").post("/contact", ...)` を親が `.use` した URL は、上と同じ `POST /api/contact` になる。

クライアントの型は、登録した `app` から Eden Treaty が作る。サーバーの `apiServerClient` は `treaty(app)` で、HTTP を出さずにそのインスタンスを呼ぶ。ブラウザの `apiClient` は `treaty<App>(location.origin)` で、同じ URL を HTTP で呼ぶ。どちらも `parseDate: false` で、日付の文字列を `Date` にしない。ブラウザの fetch は `credentials: "same-origin"`、`cache: "no-store"` である。

```ts
const { api } = apiServerClient(app, {});
const reply = await api.contact.post({ email: "a@b.test", message: "hello" });
```

`api` はプレフィックス `/api`、`contact` は URL `/contact` である。`post` の引数が JSON になる。成功は `reply.data`、失敗は `reply.error` に入り、本体を Schema で読むときは `apiData` に渡す。ブラウザから同じ呼び出しをするときは `apiClient<typeof app>()` の戻り値を使う。画面のコードをサーバーとブラウザで一つの関数にするときは `createIsomorphicFn` で分け、server 側は受信した cookie を `apiServerClient` に渡し、client 側は `apiClient` を返す。

## 採ると

| 見ているもの | 採る前 | 採ったあと |
| --- | --- | --- |
| 問い合わせの送信 | `createServerFn` には URL が無いので、ブラウザ以外はこの関数を HTTP で呼べない | `POST /api/contact` が `app.fetch` に届き、`routes.route` が `submitContact` を実行する |
| 2000 字を超える本文 | ハンドラがその場で status を決める | `MessageTooLong` が表の 400 になる。スキーマを満たさない JSON は `InputInvalid` で、この表には書かない |
| `api.contact.post` | URL と JSON の形を、サーバーとは別の型に書く | 引数と `reply.data` は登録した `app` から出る。サーバーは `treaty(app)`、ブラウザは `treaty<App>(location.origin)` で同じ URL を呼ぶ |

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
