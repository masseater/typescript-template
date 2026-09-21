---
title: TanStack Query
description: 開いたあとのサーバーデータを、クライアントの部品が共有して読む仕組み
---

TanStack Query は、サーバーにあるデータをクライアントがどう読み、いつ古いかを扱うライブラリです。`useState` と `fetch` を画面の中で組み合わせて、同じデータを複数の部品が別々に持つ、という書き方を置き換えます。

## loader や Atom との違い

時点が違います。

- [TanStack Start](/tech-stack/tanstack-start) の loader は、URL へ移るときの初期データです。
- [Effect](/tech-stack/effect) の `requestAtom` は、その画面が 1 回の取得結果を購読する形です。会員ホームのフィードはこちらです。
- Query は、開いたあとにクライアントが保持し、再取得し、キーが同じ部品のあいだで共有するデータです。定義は `queryOptions` にまとめ、画面は `useQuery` でそれを購読します。更新は `useMutation` です。

## いまどこで使っているか

計画上の位置づけは [モダン化計画](/plans/modernization) が持ちます。コード上、司令塔はすでに Query でフィードを読んでいます。`tools/commander` の `feedOptions` が `queryOptions` でサーバーからのイベント列を 1 つの購読にし、画面は `useQuery` でそれを見ます。切れると再接続し、届いたイベントで表示中の状態を更新します。

会員アプリと管理アプリの画面は、まだ Query を購読に使っていません。初期データはルートの loader、ホームや管理画面の一覧のように開いてから取るものは `requestAtom` です。

新しい画面で `useState` と `fetch` を組み合わせてサーバーのデータを読むことは、`tools/dont-review-it` の検査が止めます。その検査が指す読み口は、Query の `queryOptions` と `useQuery` です。
