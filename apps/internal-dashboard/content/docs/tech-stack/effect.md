---
title: Effect
description: 失敗の種類と必要なサービスを型に載せ、入口で実行する書き方
---

Effect は、非同期処理を「呼んだ瞬間に走る関数」ではなく、「成功の値、失敗の種類、必要なサービスを型に持った記述」として扱うライブラリです。`async` / `await` と例外に慣れていると、次の違いから入ると読みやすくなります。

- 記述は、作っただけでは動きません。`Effect.fn` や `Effect.gen` が返す値を、入口で `runPromise` したときにはじめて実行します。途中で落ちた処理を、呼び忘れの例外ではなく、実行した側が結果として受け取れます。
- 失敗は、取りこぼした `throw` ではなく型に載ります。どの失敗を成功へ畳み、どれを残すかを、呼び出し側が型で見られます。
- DB や設定のような依存は、引数で引き回す代わりに `yield*` でサービスから取ります。足りないサービスは型に残るので、入口で渡し忘れるとコンパイルが通りません。
- 外から来た未知の値（環境変数、JSON）は Effect Schema で検証してから中へ入れます。通らなければ、その値を使った処理へ進みません。

インフラの宣言も同じ書き方です。資源を宣言する仕組みは [Alchemy](/tech-stack/alchemy) です。

画面が「いまの取得結果」を購読するときは、Effect Atom（`effect/unstable/reactivity` の `Atom`）を使います。成功と失敗と待ちが 1 つの値になります。これは [TanStack Query](/tech-stack/tanstack-query) のキャッシュとは別です。

## 公式と読みもの

- 公式は [Effect](https://effect.website/) です。この節が指すのは v4 です。ドキュメント上部の版を v4 にして読んでください。
- 最初の順は [Onboarding](https://effect.website/docs/v4/onboarding)、[Running Effects](https://effect.website/docs/v4/getting-started/running-effects)、[Services](https://effect.website/docs/v4/requirements-management/services)、[Schema](https://effect.website/docs/v4/schema/introduction) です。失敗を型に分ける話は [Expected Errors](https://effect.website/docs/v4/error-management/expected-errors) にあります。
- ブラウザで試すなら [Playground](https://effect.website/play) です。
- v4 で何が変わったかのまとめは [Effect v4 RC: August 2026 Updates](https://effect.website/blog/effect-v4-rc-august-recap) です。
