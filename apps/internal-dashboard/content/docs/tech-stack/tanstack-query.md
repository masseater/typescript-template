---
title: TanStack Query
description: サーバー上のデータをクライアントが保持し、再取得し、部品間で共有するライブラリ
---

TanStack Query は、サーバー上のデータをクライアントが取得し、その鮮度を扱うライブラリである。`useState` と `fetch` を画面内で組み合わせ、同一データを複数の部品が個別に保持する方式を置き換える。

取得の時点は次のように分かれる。

- [TanStack Start](/tech-stack/tanstack-start) の loader は、URL への遷移時の初期データである。
- [Effect](/tech-stack/effect) の Atom は、その画面が 1 回の取得結果を購読する形式である。
- Query は、画面表示後にクライアントが保持し、再取得し、キーが一致する部品のあいだで共有するデータである。定義は `queryOptions` にまとめ、画面は `useQuery` で購読する。更新は `useMutation` である。

## 参照

- 公式ドキュメントは [TanStack Query](https://tanstack.com/query/latest) である。導入は [Quick Start](https://tanstack.com/query/latest/docs/framework/react/quick-start)、取得は [Queries](https://tanstack.com/query/v5/docs/framework/react/guides/queries)、更新は [Mutations](https://tanstack.com/query/latest/docs/framework/react/guides/mutations) に記載される。
- `queryOptions` の定義は [Query Options](https://tanstack.com/query/latest/docs/framework/react/guides/query-options) にある。
- 最小のサンプルは [Basic example](https://tanstack.com/query/latest/docs/framework/react/examples/basic) である。
- 解説記事は [Practical React Query](https://tkdodo.eu/blog/practical-react-query) である。`queryOptions` を扱う回は [The Query Options API](https://tkdodo.eu/blog/the-query-options-api) である。
