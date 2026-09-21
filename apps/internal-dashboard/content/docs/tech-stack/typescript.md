---
title: TypeScript
description: 画面からインフラの宣言までを同一の型検査の下に置く言語
---

画面もサーバーもインフラの宣言も、同じ TypeScript の型検査を通る。クライアントとサーバーが同じ型を参照するので、API の形を別の仕様書としてもう一度書かない。

`noUncheckedIndexedAccess` では、`names[0]` の型は `string | undefined` になる。先頭に要素があることは、型には含まれない。

```ts
const names = ["ana", "bao"];
const first: string | undefined = names[0];
```

`first` を `string` として使うには、値が入っていることを分岐で確認する。

`exactOptionalPropertyTypes` では、プロパティを書かないことと、`undefined` を渡すことが別になる。`name?: string` は「`name` が無い」を許す。次の代入は型検査で失敗する。

```ts
type Profile = { name?: string };
const explicit: Profile = { name: undefined };
```

`{}` は `Profile` として通る。

型だけの名前を値の import に混ぜると、`verbatimModuleSyntax` が失敗させる。`User` が型だけなら `import type { User }` と書く。

外から来た JSON は、届いた時点では `unknown` である。[Effect](/tech-stack/effect) の `Schema.decodeUnknownEffect` が成功した値だけを、その先の処理が読む。

[Effect](/tech-stack/effect) の `findUser` は `Database` と `UserNotFound` を型に持つ。`Database` を渡さない、`UserNotFound` を処理しない、のどちらも `tsc` が落とす。エディタの補完と診断は `@effect/language-service` が出す。

## 参考文献

- 公式 — [TypeScript](https://www.typescriptlang.org/)
- 公式 — [Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- 公式 — [noUncheckedIndexedAccess](https://www.typescriptlang.org/tsconfig/noUncheckedIndexedAccess.html)
- 公式 — [exactOptionalPropertyTypes](https://www.typescriptlang.org/tsconfig/exactOptionalPropertyTypes.html)
- 公式 — [verbatimModuleSyntax](https://www.typescriptlang.org/tsconfig/verbatimModuleSyntax.html)
- サンプル — [Playground](https://www.typescriptlang.org/play)
- 記事 — [Announcing TypeScript 7.0](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/)
