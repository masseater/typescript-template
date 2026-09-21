---
title: TypeScript
description: 画面からインフラの宣言までを同一の型検査の下に置く言語
---

TypeScript は、画面からインフラの宣言までを同じ型検査の対象にする。クライアントとサーバーが同じ型を参照するため、API の形を別の仕様としてもう一度書かなくてよい。

配列やレコードの添字に要素があることは、型だけでは決まらない。`noUncheckedIndexedAccess` を有効にすると、添字アクセスの型は `T | undefined` になり、要素の存在を別途確認しないと値として使えない。

プロパティを書かないことと、値として `undefined` を渡すことは別である。`exactOptionalPropertyTypes` を有効にすると、この二つは型の上でも別になり、省略可能なプロパティへ `undefined` を代入すると型検査が失敗する。

型だけの import を値の import と同じ構文で書くと、実行時に残る import と区別できない。`verbatimModuleSyntax` を有効にすると、型だけの import は `import type` でなければ型検査が失敗する。

外部から入った未知の値は、型として扱う前に Effect Schema で検証する。検証の定義は [Effect](/tech-stack/effect) にある。

Effect が要求するサービスが入口で供給されていないこと、および処理していない失敗が型に残っていることは、TypeScript の型検査が検出する。エディタ上の補完と診断は `@effect/language-service` が提供する。

## 参考文献

- 公式 — [TypeScript](https://www.typescriptlang.org/)
- 公式 — [Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- 公式 — [noUncheckedIndexedAccess](https://www.typescriptlang.org/tsconfig/noUncheckedIndexedAccess.html)
- 公式 — [exactOptionalPropertyTypes](https://www.typescriptlang.org/tsconfig/exactOptionalPropertyTypes.html)
- 公式 — [verbatimModuleSyntax](https://www.typescriptlang.org/tsconfig/verbatimModuleSyntax.html)
- サンプル — [Playground](https://www.typescriptlang.org/play)
- 記事 — [Announcing TypeScript 7.0](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/)
