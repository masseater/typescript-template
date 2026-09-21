# 移し方

React は 19.3 である。新規のコードに次を書かない。`project/react-legacy` と `project/atom-state` が止める。

- `forwardRef` は ref を props にする
- `<Context.Provider>` は `<Context value={...}>`
- 文字列 ref
- `defaultProps` は引数の既定値。`propTypes` は TypeScript
- `react-dom` の `render` / `hydrate` / `findDOMNode` / `unmountComponentAtNode`
- `react-dom/server` の `renderToNodeStream` / `renderToStaticNodeStream`
- `react-test-renderer`。検証は Testing Library

残っているときだけ、対象ファイルに対して次を実行する。

```bash
npx codemod react/19/remove-forward-ref --target .
npx codemod react/19/remove-context-provider --target .
npx codemod react/19/replace-string-ref --target .
npx codemod react/19/replace-reactdom-render --target .
```

`useState` を消す codemod は走らせない。置き先は Effect Atom、TanStack Form、TanStack Query、`useAction` であり、codemod はその判断をしない。
