---
title: Effect
description: 成功値、失敗の種類、必要なサービスを型に持つ記述を、入口で実行するライブラリ
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

`findUser("123")` は `Effect` を返すだけで、`find` はまだ呼ばれない。`Effect.runPromise` したときに `find` が走り、行が無ければ `UserNotFound` が結果になる。例外にはならない。`Database` を渡さない `runPromise` はコンパイルできない。どの失敗を成功の値に変えて、どれを失敗のまま返すかは、呼び出し側が型を見て決める。

JSON のように外から来た値は、`Schema.decodeUnknownEffect` が成功するまでフィールドを読まない。

画面の購読が、待っているか、値があるか、失敗したかを一つの値で持つときは Atom（`effect/unstable/reactivity`）を使う。同じキーを複数の部品が見るキャッシュは [TanStack Query](/tech-stack/tanstack-query) で、Atom はそれを持たない。

## 参考文献

- 公式 — [Effect](https://effect.website/)
- 公式 — [Onboarding](https://effect.website/docs/v4/onboarding)
- 公式 — [Running Effects](https://effect.website/docs/v4/getting-started/running-effects)
- 公式 — [Services](https://effect.website/docs/v4/requirements-management/services)
- 公式 — [Schema](https://effect.website/docs/v4/schema/introduction)
- 公式 — [Expected Errors](https://effect.website/docs/v4/error-management/expected-errors)
- サンプル — [Playground](https://effect.website/play)
- 記事 — [Effect v4 RC: August 2026 Updates](https://effect.website/blog/effect-v4-rc-august-recap)
