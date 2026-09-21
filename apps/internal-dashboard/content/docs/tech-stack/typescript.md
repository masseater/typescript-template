---
title: TypeScript
description: 画面だけでなく、インフラの宣言と検査までを通して使っている言語
---

アプリ、共通パッケージ、インフラの宣言、検査ツールまで、このリポジトリの実装は TypeScript です。画面だけの言語ではありません。Alchemy の資源宣言も、Elysia の API も、同じ型検査を通ります。

## 初めて読むときに引っかかる設定

`tsconfig.base.json` は、要素があることやプロパティの省略を、暗黙には認めません。

- 配列やレコードを添字で読むと、結果は `T | undefined` です（`noUncheckedIndexedAccess`）。要素がある前提では書けません。
- `exactOptionalPropertyTypes` により、プロパティを省略することと、`undefined` を代入することは別です。
- `verbatimModuleSyntax` により、型だけの import は `import type` に分けます。実行時に残る import と混ざっていると型検査が落ちます。

## 境界を型が 1 つ持つ

クライアントとサーバーで同じ型を使います。HTTP API は Elysia の定義がクライアントの型になり、Start の `createServerFn` は引数と戻り値をクライアントから呼べる形にします。API の形を別の仕様へ写しません。

外から来た未知の値を、その型へ入れる前に検証するのが Effect Schema です。検証の書き方は [Effect](/tech-stack/effect) にあります。

Effect の足りないサービスや、扱っていないエラーを落とすのは TypeScript の型検査です。エディタ上の補完と診断には `@effect/language-service` が乗っています。
