---
title: TypeScript
description: 画面からインフラの宣言までを同一の型検査の下に置く言語
---

TypeScript は、画面からインフラの宣言までを同一の型検査の下に置く。クライアントとサーバーは同一の型を共有し、API の形状を別の仕様として重複して持たない。

次のコンパイラオプションは、欠落を暗黙に成功として扱わない。

- `noUncheckedIndexedAccess` により、配列およびレコードの添字アクセスの型は `T | undefined` となる。要素の存在は型上保証されない。
- `exactOptionalPropertyTypes` により、プロパティの省略と `undefined` の代入は区別される。
- `verbatimModuleSyntax` により、型のみの import は `import type` とする。値として残る import と混在すると型検査は失敗する。

外部から入力された未知の値は、型へ入れる前に Effect Schema で検証する。検証の定義は [Effect](/tech-stack/effect) に記載する。

Effect におけるサービスの不足と、未処理のエラーは、TypeScript の型検査が検出する。エディタ上の補完と診断は `@effect/language-service` が提供する。

## 参照

- 公式ドキュメントは [TypeScript](https://www.typescriptlang.org/) である。言語の説明は [Handbook](https://www.typescriptlang.org/docs/handbook/intro.html) に記載される。
- 上記のオプションは [noUncheckedIndexedAccess](https://www.typescriptlang.org/tsconfig/noUncheckedIndexedAccess.html)、[exactOptionalPropertyTypes](https://www.typescriptlang.org/tsconfig/exactOptionalPropertyTypes.html)、[verbatimModuleSyntax](https://www.typescriptlang.org/tsconfig/verbatimModuleSyntax.html) に定義される。
- ブラウザ上で型検査を実行する環境は [Playground](https://www.typescriptlang.org/play) である。
- コンパイラ実装の解説は [Announcing TypeScript 7.0](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/) である。型の意味は従来と同一であり、実装がネイティブコードへ移行している。
