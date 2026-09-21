# API

大本: https://github.com/adhhamdev/modern-react-guidance/blob/main/references/api-cheatsheet.md

| API | このリポジトリ |
| --- | --- |
| `use(context)` | Context を読む。サーバーデータの取得には使わない |
| `useOptimistic` | 楽観更新。許可されている |
| `useTransition` / `startTransition` | 急がない更新 |
| `useDeferredValue` | 重い派生を入力と分ける。タイマーデバウンスの代わり |
| ref を props で受ける | `forwardRef` は拒否 |
| `<Context value>` | `<Context.Provider>` は拒否 |
| `useEffectEvent` | 依存配列に入れない |
| `<Activity>` | 隠しても状態を残す |
| `<ViewTransition>` | Transition に乗るアニメーション |
| `browser()` | ブラウザだけの部分。Suspense の内側 |
| `useAction`（`@repo/ui`） | ミューテーションの pending と error。pending 中の `run` はキュー |
| TanStack Form | フォームの値 |
| TanStack Query | サーバーデータ |
| Effect Atom | 画面の一時状態 |

`useActionState`、`useFormStatus`、`useFormState`、`useState`、`useReducer`、`useRef`、`useMemo`、`useCallback`、`memo` は拒否される。形を確認するときは react.dev のリファレンスを見る。
