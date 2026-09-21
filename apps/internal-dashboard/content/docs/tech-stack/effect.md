---
title: Effect
description: 成功値、失敗の種類、必要なサービスを型に持つ記述を、呼び出し側が実行するライブラリ
---

Effect は、成功の値と失敗と必要なサービスを型に載せた値を作り、その値を作った時点では処理を実行しない。文書とサンプルは v4 を見る。v3 の `Effect.gen` や Service の書き方は、この形と揃わない。

```ts
import { Context, Effect, Schema } from "effect";

class UserNotFound extends Schema.TaggedError<UserNotFound>()("UserNotFound", {
  id: Schema.String,
}) {}

class Database extends Context.Service<
  Database,
  {
    readonly find: (id: string) => Effect.Effect<{ readonly name: string } | undefined>;
  }
>()("Database") {}

const findUser = Effect.fn("findUser")(function* (id: string) {
  const db = yield* Database;
  const user = yield* db.find(id);
  if (user === undefined) {
    return yield* new UserNotFound({ id });
  }
  return user;
});
```

`findUser("123")` は `Effect` を返すだけで、`find` はまだ呼ばれない。`Effect.runPromise` したときに `find` が呼ばれ、行が無ければ `UserNotFound` が結果になる。例外にはならない。`Database` を渡さない `runPromise` は、その型の時点で TypeScript がコンパイルを失敗させる。どの失敗を成功の値に変えて、どれを失敗のまま返すかは、呼び出し側が型を見て決める。

`findUser("123")` の戻り値を yield も `runPromise` もしていない呼び出しは、TypeScript だけでは通る。それを失敗させるのが `effect-tsgo`（`@effect/tsgo`）である。TypeScript のネイティブコンパイラに Effect の診断を足した実行ファイルで、`tsgo` と並べては使わない。未処理の失敗が残っていること、必要なサービスがまだ型に残っていること、yield していない Effect は、実行が始まる前にここで出る。TypeScript 7 では、エディタ側のプラグイン名は `tsconfig` の `@effect/language-service` のままで、中身は `@effect/tsgo` が提供する。`@effect/language-service` パッケージは TypeScript 7 より前向けである。

```sh
effect-tsgo diagnostics --project tsconfig.json --format text --strict --severity error,warning
```

JSON のように外から来た値は、`Schema.decodeUnknownEffect` が成功するまでフィールドを読まない。

画面の購読が、待っているか、値があるか、失敗したかを一つの値で持つときは Atom（`effect/unstable/reactivity`）を使う。同じキーを複数のコンポーネントが見るキャッシュは [TanStack Query](/tech-stack/tanstack-query) で、Atom はそれを持たない。実行の区間を span として残すときは [OpenTelemetry](/tech-stack/opentelemetry) の `withSpan` を使う。

## 採ると

| 見ているもの | 採る前 | 採ったあと |
| --- | --- | --- |
| `findUser("123")` | 呼んだ時点で `find` が呼ばれ、行が無ければ例外になる | 呼んだ時点では `Effect` が返るだけ。`runPromise` したときに `find` が呼ばれ、行が無ければ `UserNotFound` になる |
| `Database` を渡さない | 実行してから、必要なサービスが無いことに気づく | その `runPromise` は、型の時点でコンパイルが失敗する |
| yield も `runPromise` もしていない呼び出し | TypeScript は通る | `effect-tsgo diagnostics` が、実行が始まる前に失敗させる |

## 参考文献

- 公式 — [Effect](https://effect.website/)
- 公式 — [Onboarding](https://effect.website/docs/v4/onboarding)
- 公式 — [Running Effects](https://effect.website/docs/v4/getting-started/running-effects)
- 公式 — [Services](https://effect.website/docs/v4/requirements-management/services)
- 公式 — [Schema](https://effect.website/docs/v4/schema/introduction)
- 公式 — [Expected Errors](https://effect.website/docs/v4/error-management/expected-errors)
- サンプル — [Playground](https://effect.website/play)
- 公式 — [Effect-TS/tsgo](https://github.com/Effect-TS/tsgo)
- 公式 — [@effect/tsgo](https://www.npmjs.com/package/@effect/tsgo)
- 公式 — [Effect-TS/language-service](https://github.com/Effect-TS/language-service)
- 記事 — [Effect v4 RC: August 2026 Updates](https://effect.website/blog/effect-v4-rc-august-recap)
