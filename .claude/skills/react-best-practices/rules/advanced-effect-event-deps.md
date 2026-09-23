# useEffectEvent を依存配列に入れない

大本: https://github.com/vercel-labs/agent-skills/blob/main/skills/react-best-practices/rules/advanced-effect-event-deps.md

`useEffectEvent` が返す関数の同一性はレンダーごとに変わる。`useEffect` と `useLayoutEffect` の依存配列に入れると、Effect が毎レンダー走り直す。

依存配列には、購読を張り直すべき値だけを置く。Effect Event はその本体から呼ぶ。`project/effect-event-deps` が依存配列への混入を拒否する。
