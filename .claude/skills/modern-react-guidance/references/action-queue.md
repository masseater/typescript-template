# 操作を止めないミューテーション

大本: https://zenn.dev/uhyo/articles/async-react-action-queue

出典は `useActionState` のキューイングで、同じ操作列を並行実行せず順番に処理し、そのあいだもユーザーの次の操作を受け付ける、という UX を示している。このリポジトリでは `useActionState` は `project/atom-state` が拒否する。同じ並びは `@repo/ui` の `useAction` が担う。`run` は pending 中でも受け付け、先に入れた task が終わってから次を実行する。

## やる

- 順番が仕様のミューテーション（追加のあとに確定、など）は、同じ `useAction` に載せる。別インスタンスに分けて並行起動しない。
- `useOptimistic` と `startTransition` で画面はすぐ更新する。pending は半透明など演出に使い、追加ボタンを `blocked` / `pending` で無効にしない。
- 確定など、進行中の列の後ろに載せたい操作も同じ `run` に入れる。

## やらない

- pending だからといって操作列全体をボタン無効で止める。
- 順番が仕様なのに `Effect.all(..., { concurrency: "unbounded" })` や複数の `useAction` で並行に飛ばす。
- キューを `useRef` や `useState` で自前実装する。`useAction` の `run` に載せる。
- `useActionState` / `useFormStatus` に戻す。

一度きりの送信フォームは、いまどおり `disabled={action.blocked}` と `aria-busy={action.pending}` で二重送信を防いでよい。操作を連打させたい列だけ、上の「やる」に従う。
