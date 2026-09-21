---
title: TanStack Query
description: サーバーのデータを、クライアントの部品が共有して読む仕組み
---

TanStack Query は、サーバーにあるデータをクライアントがどう読み、いつ古いかを扱うライブラリです。`useState` と `fetch` を画面の中で組み合わせて、同じデータを複数の部品が別々に持つ、という書き方を置き換えます。

時点が違います。

- [TanStack Start](/tech-stack/tanstack-start) の loader は、URL へ移るときの初期データです。
- [Effect](/tech-stack/effect) の Atom は、その画面が 1 回の取得結果を購読する形です。
- Query は、開いたあとにクライアントが保持し、再取得し、キーが同じ部品のあいだで共有するデータです。定義は `queryOptions` にまとめ、画面は `useQuery` でそれを購読します。更新は `useMutation` です。

## 公式と読みもの

- 公式は [TanStack Query](https://tanstack.com/query/latest) です。最初に読むなら [Quick Start](https://tanstack.com/query/latest/docs/framework/react/quick-start)、[Queries](https://tanstack.com/query/v5/docs/framework/react/guides/queries)、[Mutations](https://tanstack.com/query/latest/docs/framework/react/guides/mutations) です。
- `queryOptions` にまとめる理由は [Query Options](https://tanstack.com/query/latest/docs/framework/react/guides/query-options) にあります。
- 動く最小例は [Basic example](https://tanstack.com/query/latest/docs/framework/react/examples/basic) です。
- メンテナ自身の連載が [Practical React Query](https://tkdodo.eu/blog/practical-react-query) です。`queryOptions` の回は [The Query Options API](https://tkdodo.eu/blog/the-query-options-api) です。
