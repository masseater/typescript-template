# 並行 UI

大本: https://github.com/adhhamdev/modern-react-guidance/blob/main/references/concurrent-ux.md

## ViewTransition

遷移、Suspense の表示、deferred 更新に乗る出入りは `<ViewTransition>`。`startTransition` の中で状態を変える。状態の入れ物は Effect Atom で、`useState` は使わない。

## Activity

タブ、サイドバー、行き来しても入力を残したい画面は `<Activity mode={open ? "visible" : "hidden"}>`。`hidden` は Effect を破棄し更新の優先度を下げるが、state と DOM は残す。条件でアンマウントして state を捨てる代わりに使う。

## useEffectEvent

Effect が購読する対象は依存配列に残し、購読のたびに最新でなくてよい値は `useEffectEvent` に移す。その関数を依存配列に入れない。`project/effect-event-deps` が拒否する。

## browser()

ブラウザだけで描く部分は `react-dom` の `browser()` を `use()` する。サーバーではサスペンドするので Suspense の内側に置く。`typeof window` で木を分けない。

## deferred

入力を止めずに遅れさせてよい派生（検索結果、フィルタ）は `useDeferredValue`。急がない更新は `useTransition`。
