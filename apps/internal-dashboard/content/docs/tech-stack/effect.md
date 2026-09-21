---
title: Effect
description: 成功値、失敗の種類、必要なサービスを型に持つ記述を、入口で実行するライブラリ
---

Effect は、非同期処理を、成功の値、失敗の種類、必要なサービスを型に持つ記述として扱うライブラリである。

対象は v4 である。v3 向けの文書やサンプルは、以下の API と一致しない。

`Effect.fn` または `Effect.gen` で記述を組み立てても、その時点では処理は実行されない。実行されるのは、入口で `runPromise` したときである。`runPromise` した側は、成功の値か、型に含まれる失敗かを結果として受け取る。失敗を捕捉されない例外として外へ出すと、どの失敗があり得るかを型で区別できない。

呼び出し側は、どの失敗を成功の値へ変換し、どれを失敗のまま残すかを、型で区別する。

データベースや設定といった依存は、引数で渡す代わりに `yield*` でサービスから取る。足りないサービスは型に残る。入口で供給しなければ、コンパイルが失敗する。

外部から入った未知の値、たとえば環境変数や JSON は、Effect Schema で検証してから後続の処理へ渡す。検証に失敗した値は、その先へ渡らない。

画面が取得結果を購読するときは、Effect Atom（`effect/unstable/reactivity` の `Atom`）を使える。一つの購読が、成功、失敗、待機を一つの値で表す。[TanStack Query](/tech-stack/tanstack-query) はキーごとに取得結果を共有するが、Atom はその購読一個の状態を表す。

## 参考文献

- 公式 — [Effect](https://effect.website/)
- 公式 — [Onboarding](https://effect.website/docs/v4/onboarding)
- 公式 — [Running Effects](https://effect.website/docs/v4/getting-started/running-effects)
- 公式 — [Services](https://effect.website/docs/v4/requirements-management/services)
- 公式 — [Schema](https://effect.website/docs/v4/schema/introduction)
- 公式 — [Expected Errors](https://effect.website/docs/v4/error-management/expected-errors)
- サンプル — [Playground](https://effect.website/play)
- 記事 — [Effect v4 RC: August 2026 Updates](https://effect.website/blog/effect-v4-rc-august-recap)
