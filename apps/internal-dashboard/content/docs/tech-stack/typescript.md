---
title: TypeScript
description: 画面からインフラの宣言までを同一の型検査の下に置く言語
---

画面、サーバー、インフラの宣言は同じ TypeScript を通る。クライアントとサーバーが同じ型を参照するので、API の形を別の仕様として持たない。

`noUncheckedIndexedAccess` では、添字アクセスの型が `T | undefined` になる。`ids[0]` を `string` として使うには、要素があることを先に確認する。

```ts
const ids = ["u1", "u2"];
const first: string | undefined = ids[0];
```

`exactOptionalPropertyTypes` では、プロパティを省略することと `undefined` を代入することが別の型になる。下の代入は失敗する。`{}` は `Profile` として通る。

```ts
type Profile = { name?: string };
const assigned: Profile = { name: undefined };
```

`verbatimModuleSyntax` では、型だけの名前を `import type` で入れる。`import { User }` のように値の import と混ぜると、型検査が失敗する。

実行時に外から入った値には型が無い。フィールドを読む前に、[Effect](/tech-stack/effect) の `Schema.decodeUnknownEffect` へ通す。`runPromise` の型に失敗やサービスが残っているときは、TypeScript がコンパイルを失敗させる。yield していない Effect のように、入口より前で出す診断は [Effect](/tech-stack/effect) の `effect-tsgo` が持つ。

## 参考文献

- 公式 — [TypeScript](https://www.typescriptlang.org/)
- 公式 — [Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- 公式 — [noUncheckedIndexedAccess](https://www.typescriptlang.org/tsconfig/noUncheckedIndexedAccess.html)
- 公式 — [exactOptionalPropertyTypes](https://www.typescriptlang.org/tsconfig/exactOptionalPropertyTypes.html)
- 公式 — [verbatimModuleSyntax](https://www.typescriptlang.org/tsconfig/verbatimModuleSyntax.html)
- サンプル — [Playground](https://www.typescriptlang.org/play)
- 記事 — [Announcing TypeScript 7.0](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/)
