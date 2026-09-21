---
title: TypeScript
description: 画面だけでなく、インフラの宣言まで通す言語
---

TypeScript は、画面だけの言語ではありません。インフラの宣言まで、同じ型検査を通します。クライアントとサーバーで同じ型を使い、API の形を別の仕様へ写しません。

初めて読むときに引っかかりやすいのは、要素があることやプロパティの省略を、暗黙には認めない設定です。

- 配列やレコードを添字で読むと、結果は `T | undefined` です（`noUncheckedIndexedAccess`）。要素がある前提では書けません。
- `exactOptionalPropertyTypes` により、プロパティを省略することと、`undefined` を代入することは別です。
- `verbatimModuleSyntax` により、型だけの import は `import type` に分けます。実行時に残る import と混ざっていると型検査が落ちます。

外から来た未知の値を、その型へ入れる前に検証するのが Effect Schema です。検証の書き方は [Effect](/tech-stack/effect) にあります。

足りないサービスや、扱っていないエラーを落とすのは TypeScript の型検査です。エディタ上の補完と診断には `@effect/language-service` が乗ります。

## 公式と読みもの

- 公式は [TypeScript](https://www.typescriptlang.org/) です。読み始めは [Handbook](https://www.typescriptlang.org/docs/handbook/intro.html) です。
- 上の 3 つの設定は [noUncheckedIndexedAccess](https://www.typescriptlang.org/tsconfig/noUncheckedIndexedAccess.html)、[exactOptionalPropertyTypes](https://www.typescriptlang.org/tsconfig/exactOptionalPropertyTypes.html)、[verbatimModuleSyntax](https://www.typescriptlang.org/tsconfig/verbatimModuleSyntax.html) に説明があります。
- その場で試すなら [Playground](https://www.typescriptlang.org/play) です。
- いまのコンパイラが何であるかは [Announcing TypeScript 7.0](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/) にあります。型の意味はそれまでと同じで、実行がネイティブ実装になっています。
