# フォームとミューテーション

大本: https://github.com/adhhamdev/modern-react-guidance/blob/main/references/actions-and-forms.md

出典の `useActionState` / `useFormStatus` / `useFormState` はこのリポジトリでは `project/atom-state` が拒否する。

- フォームの値は TanStack Form。
- 送信の pending と error は `@repo/ui` の `useAction`。`run` に非同期処理を渡す。
- 楽観更新が要るときだけ `useOptimistic` を足す。pending を自前の boolean で持たない。
- 入力を `useState` で組み立てない。画面の一時状態は Effect Atom。

`<form action={...}>` に React の Action を渡す書き方は採らない。既存のフォームは `onSubmit={form.handleSubmit}` と `aria-busy={form.pending}` である。
