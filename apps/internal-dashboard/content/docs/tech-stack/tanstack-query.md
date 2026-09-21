---
title: TanStack Query
description: サーバー上のデータをクライアントが保持し、再取得し、コンポーネント間で共有するライブラリ
---

TanStack Query は、サーバーから取った結果をクライアントがキーごとに保持する。`useState` と `fetch` をコンポーネントの中に書くと、同じデータをコンポーネントの数だけ持つ。`queryOptions` にキーと取得をまとめ、画面は `useQuery` でそのキーを購読する。同じ `queryKey` を読むコンポーネントは、同じ結果を見る。

```ts
const userOptions = queryOptions({
  queryKey: ["user", userId],
  queryFn: () => fetchUser(userId),
});

useQuery(userOptions);
```

URL を開いた直後の初期データは、このキーとは別で、[TanStack Start](/tech-stack/tanstack-start) の loader が返す。loader は表示後の再取得を持たない。更新のあとで取り直す手続きは `useMutation` に書く。

[Effect](/tech-stack/effect) の Atom は購読一つの状態で、`queryKey` を持たない。待っているか、成功したか、失敗したかを、その購読の値として持つ。

## 採ると

| 見ているもの | 採る前 | 採ったあと |
| --- | --- | --- |
| 同じ `userId` を二つの画面が見る | それぞれが `useState` と `fetch` を持ち、結果が二つになる | 同じ `queryKey: ["user", userId]` を `useQuery` すると、同じ結果を見る |
| URL を開いた直後 | 取得の結果を、その画面の state が持ち続ける | loader が初期データだけを返す。表示したあとの再取得は `queryKey` の側にある |
| 更新したあと | 取得の関数を、その画面がもう一度呼ぶ | 取り直す手続きは `useMutation` に書く。Atom は `queryKey` を持たない |

## 参考文献

- 公式 — [TanStack Query](https://tanstack.com/query/latest)
- 公式 — [Quick Start](https://tanstack.com/query/latest/docs/framework/react/quick-start)
- 公式 — [Queries](https://tanstack.com/query/v5/docs/framework/react/guides/queries)
- 公式 — [Mutations](https://tanstack.com/query/latest/docs/framework/react/guides/mutations)
- 公式 — [Query Options](https://tanstack.com/query/latest/docs/framework/react/guides/query-options)
- サンプル — [Basic example](https://tanstack.com/query/latest/docs/framework/react/examples/basic)
- 記事 — [Practical React Query](https://tkdodo.eu/blog/practical-react-query)
- 記事 — [The Query Options API](https://tkdodo.eu/blog/the-query-options-api)
