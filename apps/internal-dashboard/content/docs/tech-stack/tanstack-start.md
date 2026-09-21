---
title: TanStack Start
description: URL を画面に対応させ、初期データとサーバー専用の処理を扱うフレームワーク
---

ファイル名が URL になる。

| ファイル | 結果 |
| --- | --- |
| `src/routes/_member.tsx` | レイアウト。URL には出ない |
| `src/routes/_member/users.$id.tsx` | `/users/123` |
| `src/routes/_member/-form.tsx` | ルートにならない |

`_` で始まる区間はパスに入らない。`-` で始まるファイルはルートツリーの外に置ける。`$id` がその位置の値で、上の例では `123` である。

`/users/123` を開いたときの初期データは、`users.$id.tsx` の loader が返す。開いたあとに同じユーザーを取り直すキャッシュは loader にはない。それは [TanStack Query](/tech-stack/tanstack-query) が持つ。

クリックからサーバーの処理を呼ぶときは `createServerFn` を使う。

```ts
const renameUser = createServerFn({ method: "POST" })
  .validator((input: { readonly id: string; readonly name: string }) => input)
  .handler(async ({ data }) => data.name);
```

`renameUser` はクライアントから呼べる。`handler` が実行されるのはサーバーだけである。この関数は、外部に公開する URL にはならない。外から HTTP で受ける入口はサーバールートである。

実行環境は Cloudflare Workers で、開発時も本番と同じ workerd で動く。

## 参考文献

- 公式 — [TanStack Start](https://tanstack.com/start/latest)
- 公式 — [Overview](https://tanstack.com/start/latest/docs/framework/react/overview)
- 公式 — [Server Functions](https://tanstack.com/start/latest/docs/framework/react/guide/server-functions)
- 公式 — [Hosting](https://tanstack.com/start/latest/docs/framework/react/guide/hosting)
- 公式 — [TanStack Start · Cloudflare Workers](https://developers.cloudflare.com/workers/framework-guides/web-apps/tanstack-start/)
- サンプル — [start-basic-cloudflare](https://github.com/TanStack/router/tree/main/examples/react/start-basic-cloudflare)
- 記事 — [TanStack Start v1 Release Candidate](https://tanstack.com/blog/announcing-tanstack-start-v1)
- 記事 — [Why choose TanStack Start and Router?](https://tanstack.com/blog/why-tanstack-start-and-router)
