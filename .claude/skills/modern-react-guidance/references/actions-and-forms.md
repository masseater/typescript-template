# フォームとミューテーション

大本: https://github.com/adhhamdev/modern-react-guidance/blob/main/references/actions-and-forms.md

出典の `useActionState` / `useFormStatus` / `useFormState` はこのリポジトリでは `project/atom-state` が拒否する。

- フォームの値は TanStack Form。
- 送信の pending と error は `@repo/ui` の `useAction`。`run` に非同期処理を渡す。pending 中の `run` は捨てず、同じインスタンス上で順番に実行する。
- 楽観更新が要るときだけ `useOptimistic` を足す。pending を自前の boolean で持たない。
- 入力を `useState` で組み立てない。画面の一時状態は Effect Atom。
- 操作を止めないキューと楽観更新は `action-queue.md`（大本 https://zenn.dev/uhyo/articles/async-react-action-queue ）。

`<form action={...}>` に React の Action を渡す書き方は採らない。既存のフォームは `onSubmit={form.handleSubmit}` と `aria-busy={form.pending}` である。一度きりの送信は `disabled={action.blocked}` でよい。
