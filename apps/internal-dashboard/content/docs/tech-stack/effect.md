---
title: Effect
description: 成功値、失敗の種類、必要なサービスを型に持つ記述を、入口で実行するライブラリ
---

Effect は、非同期処理を、呼び出しと同時に実行される関数ではなく、成功の値、失敗の種類、必要なサービスを型に持つ記述として扱うライブラリである。`async` / `await` と例外との相違は次のとおりである。

- 記述を構築した時点では実行されない。`Effect.fn` または `Effect.gen` が返す値は、入口で `runPromise` されたときに実行される。失敗は、捕捉されない例外ではなく、実行側が受け取る結果である。
- 失敗は型に含まれる。どの失敗を成功へ畳み、どれを残すかは、呼び出し側が型によって判別する。
- データベースや設定などの依存は、引数で受け渡す代わりに `yield*` によってサービスから取得する。不足したサービスは型に残るため、入口で供給しない場合はコンパイルが失敗する。
- 外部から入力された未知の値（環境変数、JSON）は、Effect Schema によって検証された後に内部へ入る。検証に失敗した場合、その値を用いる処理へは進まない。

画面上で取得結果を購読する機構として、Effect Atom（`effect/unstable/reactivity` の `Atom`）がある。成功、失敗、待機が単一の値になる。これは [TanStack Query](/tech-stack/tanstack-query) のキャッシュとは別である。

## 参照

- 公式ドキュメントは [Effect](https://effect.website/) である。この節が参照するのは v4 であり、ドキュメントの版選択は v4 とする。
- 導入は [Onboarding](https://effect.website/docs/v4/onboarding)、実行は [Running Effects](https://effect.website/docs/v4/getting-started/running-effects)、サービスは [Services](https://effect.website/docs/v4/requirements-management/services)、スキーマは [Schema](https://effect.website/docs/v4/schema/introduction) に記載される。失敗を型で区別する定義は [Expected Errors](https://effect.website/docs/v4/error-management/expected-errors) にある。
- ブラウザ上で実行する環境は [Playground](https://effect.website/play) である。
- v4 の変更点をまとめた記事は [Effect v4 RC: August 2026 Updates](https://effect.website/blog/effect-v4-rc-august-recap) である。
