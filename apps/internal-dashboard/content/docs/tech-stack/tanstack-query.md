---
title: TanStack Query
description: サーバー上のデータをクライアントが保持し、再取得し、部品間で共有するライブラリ
---

TanStack Query は、サーバー上のデータをクライアントが取得し、その鮮度を扱うライブラリである。`useState` と `fetch` を画面の中で組むと、同じデータを複数の部品がそれぞれ保持する。Query は取得結果をキーに紐づけ、同じキーの部品がその結果を共有する。

遷移時の初期データは、このキャッシュではない。[TanStack Start](/tech-stack/tanstack-start) の loader が、その URL へ遷移するときに初期データを返す。loader は表示後に結果を保持しない。

一つの購読の状態も、このキャッシュではない。[Effect](/tech-stack/effect) の Atom は、成功、失敗、待機をその購読の値として表す。キーから結果を引くキャッシュは持たない。

定義は `queryOptions` にまとめ、画面は `useQuery` で購読する。更新の手続きは `useMutation` で書く。

## 参考文献

- 公式 — [TanStack Query](https://tanstack.com/query/latest)
- 公式 — [Quick Start](https://tanstack.com/query/latest/docs/framework/react/quick-start)
- 公式 — [Queries](https://tanstack.com/query/v5/docs/framework/react/guides/queries)
- 公式 — [Mutations](https://tanstack.com/query/latest/docs/framework/react/guides/mutations)
- 公式 — [Query Options](https://tanstack.com/query/latest/docs/framework/react/guides/query-options)
- サンプル — [Basic example](https://tanstack.com/query/latest/docs/framework/react/examples/basic)
- 記事 — [Practical React Query](https://tkdodo.eu/blog/practical-react-query)
- 記事 — [The Query Options API](https://tkdodo.eu/blog/the-query-options-api)
