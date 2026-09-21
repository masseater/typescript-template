---
title: TanStack Query
description: サーバー上のデータをクライアントが保持し、再取得し、部品間で共有するライブラリ
---

同じユーザーを、ヘッダーとサイドバーの両方が表示する。

```ts
const userOptions = queryOptions({
  queryKey: ["user", id],
  queryFn: () => fetchUser(id),
});

const header = useQuery(userOptions);
const sidebar = useQuery(userOptions);
```

両方とも `["user", id]` を見る。取得は一回で、どちらかが再取得すると、もう片方も新しい結果を受け取る。`useState` と `fetch` を部品ごとに書くと、この共有は起きず、古い名前が片方だけ残る。

`/users/123` を開いた直後の初期データは、[TanStack Start](/tech-stack/tanstack-start) の loader が返す。loader は `["user", id]` を持たない。

[Effect](/tech-stack/effect) の Atom は、その購読ひとつが「読み込み中か、ユーザーか、失敗か」を表す。別の部品が同じキーで結果を引くキャッシュではない。

名前を変えたあとに取り直す手続きは `useMutation` で書く。

## 参考文献

- 公式 — [TanStack Query](https://tanstack.com/query/latest)
- 公式 — [Quick Start](https://tanstack.com/query/latest/docs/framework/react/quick-start)
- 公式 — [Queries](https://tanstack.com/query/v5/docs/framework/react/guides/queries)
- 公式 — [Mutations](https://tanstack.com/query/latest/docs/framework/react/guides/mutations)
- 公式 — [Query Options](https://tanstack.com/query/latest/docs/framework/react/guides/query-options)
- サンプル — [Basic example](https://tanstack.com/query/latest/docs/framework/react/examples/basic)
- 記事 — [Practical React Query](https://tkdodo.eu/blog/practical-react-query)
- 記事 — [The Query Options API](https://tkdodo.eu/blog/the-query-options-api)
