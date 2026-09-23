# 宣言的 UI とトランジション

大本: https://speakerdeck.com/uhyo/react-no-sekkeiron

宣言的 UI は `UI = f(state)` だけでは足りない。制約と保証を正確に宣言し、その範囲で React が UX を最適化する、というのがこのトークの設計論である。`useActionState` の話はトークでは記事送りなので `action-queue.md` を読む。

## 保証

- 一貫性: 変化前と変化後の UI が混ざらない。
- 即時性: ステート更新が最優先で画面に出る。

緩めるときは、その緩和を API で宣言する。

| 緩和 | API | 使うとき |
| --- | --- | --- |
| 即時性 | `useTransition` / `startTransition` / `useAction` の `run` / `Button` の `action` | イベントで起きる画面の変化のほぼ全部 |
| 一貫性 | `useDeferredValue` | 入力と重い一覧を同じコミットに載せなくてよいとき |

緊急更新（即時性を外さない更新）は少ない。すでに起きた外部の変化に React の状態を合わせるものだけを緊急にする。制御フォームの値は TanStack Form。`useSyncExternalStore` と `useState` は使わない。

## Suspense

境界は「一緒に出す／別々に出してよい」という独立性の制約である。殻とデータは `react-best-practices` の `async-suspense-boundaries` に従う。再サスペンドでスケルトンに戻すより、トランジションで古い画面を残す。

## トランジションを前提にする

画面を変えるイベント更新はトランジションが既定である。トランジションにすることに特別な目的意識は要らない。外すほうが特別である。

- ミューテーションは `@repo/ui` の `useAction().run`。内部で `startTransition` に載る。
- クリックで起こす処理は `Button` の `action` prop に渡す。`onClick` で同じことを手書きしない。`type="submit"` ではフォームの `onSubmit` と `useAction` を使い、`action` prop は使わない。
- トランジション中にすぐ見せたい表示は `useOptimistic`。pending 演出にも使う。
- 順番が仕様の更新列は同じ `useAction` に載せ、操作を `blocked` で止めない（`action-queue.md`）。

`isPending` は「その操作が起こした遷移の最中」である。`await` が終わっても、サスペンドが残っていればトランジションは続く。
