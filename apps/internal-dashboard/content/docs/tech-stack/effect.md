---
title: Effect
description: 成功値、失敗の種類、必要なサービスを型に持つ記述を、入口で実行するライブラリ
---

`findUser` を定義しただけでは、データベースは見に行かない。

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

`findUser("123")` が返すのは、まだ実行されていない記述である。`Effect.runPromise` したときに `find` が走り、ユーザーがいなければ `UserNotFound` が結果として返る。`throw` ではないので、呼び出し側は `UserNotFound` を成功へ変換するか、失敗のまま残すかを型で分岐する。`Database` を渡さずに `runPromise` すると、コンパイルが失敗する。

この書き方は v4 である。v3 の記事にある `Effect.gen` やサービスの形は、そのまま置き換わらない。

リクエストの JSON は `unknown` である。`Schema.decodeUnknownEffect` が成功した値だけが、次の処理へ渡る。

画面が「読み込み中か、ユーザーか、`UserNotFound` か」を一つの購読で持つときは、Effect Atom（`effect/unstable/reactivity` の `Atom`）を使う。[TanStack Query](/tech-stack/tanstack-query) の `["user", id]` は、別の部品と同じ結果を共有するキャッシュである。Atom はそのキャッシュを持たない。

## 参考文献

- 公式 — [Effect](https://effect.website/)
- 公式 — [Onboarding](https://effect.website/docs/v4/onboarding)
- 公式 — [Running Effects](https://effect.website/docs/v4/getting-started/running-effects)
- 公式 — [Services](https://effect.website/docs/v4/requirements-management/services)
- 公式 — [Schema](https://effect.website/docs/v4/schema/introduction)
- 公式 — [Expected Errors](https://effect.website/docs/v4/error-management/expected-errors)
- サンプル — [Playground](https://effect.website/play)
- 記事 — [Effect v4 RC: August 2026 Updates](https://effect.website/blog/effect-v4-rc-august-recap)
