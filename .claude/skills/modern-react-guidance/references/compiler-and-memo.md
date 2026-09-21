# Compiler とメモ化

React Compiler は `@repo/vite-config` の `react({ compiler: { logDiagnostics: true } })` で有効である。

`useMemo`、`useCallback`、`React.memo` は別名や分割代入も含めて `project/no-manual-memoization` が拒否する。残している手書きメモ化を広げない。新しいものも足さない。

Rules of React はそのまま守る。レンダーは純粋にし、レンダー中に props と state を書き換えない。
