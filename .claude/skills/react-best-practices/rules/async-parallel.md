# 独立した処理は同時に走らせる

前の結果を使わない処理を、順番に `yield*` したり `await` したりしない。

Effect では `Effect.all` か `Effect.forEach` に `{ concurrency: "unbounded" }` を渡す。順番が仕様なら `{ concurrency: "unbounded" }` ではなく `{ concurrency: 1 }` と書く。

Effect の外では `Promise.all`。`.then` で繋がない。
