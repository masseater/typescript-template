---
title: TanStack Start
description: URL を画面に対応させ、初期データとサーバー専用の処理を扱うフレームワーク
---

TanStack Start は、React の画面とサーバー側の処理を同じルーティングに載せる。実行は Cloudflare Workers で、開発時も workerd である。

経路は `src/routes` のファイル名から決まる。`_member/users.$id.tsx` は `/users/123` になり、フォルダ `_member` は URL に出ない。`-form.tsx` のように名前が `-` で始まるファイルはルートにならないので、ルートの隣にコンポーネントを置ける。

その URL を開いたときにサーバーで走るのが loader で、返すのは画面の初期データだけである。表示したあとに同じデータを取り直す処理は loader に書かない。[TanStack Query](/tech-stack/tanstack-query) の `queryKey` に書く。

ブラウザから呼べて、本体がサーバーでだけ実行される関数は `createServerFn` である。`handler` は URL として公開されない。ブラウザ以外が HTTP で呼ぶ API は、サーバールートに置く。

```ts
const renameUser = createServerFn({ method: "POST" })
  .validator((input: { readonly id: string; readonly name: string }) => input)
  .handler(async ({ data }) => data.name);
```

## 参考文献

- 公式 — [TanStack Start](https://tanstack.com/start/latest)
- 公式 — [Overview](https://tanstack.com/start/latest/docs/framework/react/overview)
- 公式 — [Server Functions](https://tanstack.com/start/latest/docs/framework/react/guide/server-functions)
- 公式 — [Hosting](https://tanstack.com/start/latest/docs/framework/react/guide/hosting)
- 公式 — [TanStack Start · Cloudflare Workers](https://developers.cloudflare.com/workers/framework-guides/web-apps/tanstack-start/)
- サンプル — [start-basic-cloudflare](https://github.com/TanStack/router/tree/main/examples/react/start-basic-cloudflare)
- 記事 — [TanStack Start v1 Release Candidate](https://tanstack.com/blog/announcing-tanstack-start-v1)
- 記事 — [Why choose TanStack Start and Router?](https://tanstack.com/blog/why-tanstack-start-and-router)
