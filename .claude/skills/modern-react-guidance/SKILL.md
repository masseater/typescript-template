---
name: modern-react-guidance
description: >
  React 19.3 の部品を書く・直す・レビューするときに読む。Compiler、ref を props として渡す、Context の value、ViewTransition、Activity、useEffectEvent、browser()、Effect の置き場所を決める。フォームとクライアント状態とサーバー読み取りは Effect Atom、@repo/ui の useAction、TanStack Form、TanStack Query に合わせ、useActionState・useFormStatus・useState・手書きの useEffect fetch には戻さない。瀑布は react-best-practices を読む。
license: MIT
metadata:
  version: "1.0.0"
  upstream: https://github.com/adhhamdev/modern-react-guidance
  react-target: "19.3"
---

# Modern React Guidance

大本は https://github.com/adhhamdev/modern-react-guidance （MIT、`LICENSE`）。元になった async-react の議論は https://github.com/reactwg/async-react/discussions/12 。React 19.3 と React Compiler が有効なこのリポジトリ向けに、既にある lint と衝突する手順は下の拘束に置き換えてある。拘束と出典が食い違うときは拘束を採る。

非同期の待ち方（独立した処理を直列に待たない、安い条件を先に見る、Suspense で殻だけ先に出す）は `.claude/skills/react-best-practices/SKILL.md` が正本である。

## 拘束

| やりたいこと | 使うもの | 使わないもの |
| --- | --- | --- |
| 画面の一時状態 | Effect Atom（`useAtom`、`Atom.make`、`localState`） | `useState`、`useReducer`、`useRef`、`createRef`、`useSyncExternalStore`、`useActionState` |
| フォームの値 | TanStack Form | `useFormStatus`、`useFormState`、入力を `useState` で持つこと |
| 送信の pending と error | `@repo/ui` の `useAction` | `useActionState`、`useFormStatus`、自前の pending フラグ |
| サーバーデータ | TanStack Query。`queryOptions` は FSD の `api` セグメント | `use(promise)` での取得、`useEffect` と `fetch` と `useState` の組み合わせ、Atom にサーバー応答を載せる |
| 楽観更新 | `useOptimistic` | 自前の巻き戻し状態 |
| 急がない更新 | `useTransition` / `startTransition` | |
| メモ化 | 書かない。Compiler が行う | `useMemo`、`useCallback`、`React.memo` |
| ref | 関数の props | `forwardRef`、文字列 ref、`useRef` |
| Context | `<Context value={...}>` と `use(Context)` | `<Context.Provider>` |
| ブラウザだけで描く部分 | `use(browser())`（`react-dom`）を Suspense の内側で | `typeof window` で描画を分ける |
| 隠しても状態を残す | `<Activity mode="hidden">` | 条件付きアンマウントだけで状態を捨てる |
| 遷移のアニメーション | `<ViewTransition>` | |
| Effect から最新の props を読む | `useEffectEvent`。依存配列には入れない | その関数を依存配列に足して購読をやり直す |

`project/atom-state`、`project/no-manual-memoization`、`project/react-legacy`、`project/effect-event-deps` がこの表の機械的な部分を検査する。抑制コメントで通さない。

## 部品を書くとき

1. ref は props で受け取る。`forwardRef` で包まない。
2. Context は `<ThemeContext value={theme}>`。子は `use(ThemeContext)`。
3. 派生値はレンダー中に計算する。Effect で props を state にコピーしない。
4. Effect は React の外（DOM、計測、購読、ウィジェット）と同期するときだけ。後始末を返す。
5. データの取得は TanStack Query。Effect の中で `fetch` しない。
6. ミューテーションは `useAction`。フォームの値は TanStack Form。
7. `useMemo` / `useCallback` / `memo` を足さない。
8. ブラウザ API に触る部分は `use(browser())`。
9. タブやサイドバーのように隠しても状態を残すなら `<Activity>`。
10. Transition に乗る出入りは `<ViewTransition>`。
11. `useEffectEvent` の結果は Effect の依存配列に置かない。

## 参照

- `references/actions-and-forms.md` — https://github.com/adhhamdev/modern-react-guidance/blob/main/references/actions-and-forms.md
- `references/compiler-and-memo.md` — https://github.com/adhhamdev/modern-react-guidance/blob/main/references/compiler-and-memo.md
- `references/concurrent-ux.md` — https://github.com/adhhamdev/modern-react-guidance/blob/main/references/concurrent-ux.md
- `references/effects-and-data.md` — https://github.com/adhhamdev/modern-react-guidance/blob/main/references/effects-and-data.md
- `references/migration-codemods.md` — https://github.com/adhhamdev/modern-react-guidance/blob/main/references/migration-codemods.md
- `references/api-cheatsheet.md` — https://github.com/adhhamdev/modern-react-guidance/blob/main/references/api-cheatsheet.md

不確かな API の形は react.dev の該当リファレンスを見る。出典の例を、上の表が禁じているフックのまま写さない。
