---
title: Drizzle
description: SQL に近い TypeScript で SQLite のテーブルとクエリを定義する ORM
---

テーブルを TypeScript で書くと、行の型はそこから出る。

```ts
const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
});

const found = await db.select().from(user).where(eq(user.id, "123"));
```

`found` の要素は `{ id: string; name: string }` になる。列を足すと、この型も、Drizzle Kit が生成するマイグレーションも変わる。接続先は SQLite で、Cloudflare ではその実体が [D1](/tech-stack/cloudflare) である。

D1 には、結果を見てから次の SQL を送る対話的なトランザクションがない。二つの挿入が先に決まっているなら、`batch` で一度に送る。`audit` は `user` と同じく `sqliteTable` で定義したテーブルである。

```ts
await db.batch([
  db.insert(user).values({ id: "123", name: "ana" }),
  db.insert(audit).values({ userId: "123", action: "create" }),
]);
```

行の検証をテーブルと別に手書きしないときは、`createSelectSchema(user)` で Effect Schema を生成する。検証に失敗した値をどう扱うかは [Effect](/tech-stack/effect) にある。

## 参考文献

- 公式 — [Drizzle ORM](https://orm.drizzle.team/)
- 公式 — [Get started](https://orm.drizzle.team/docs/get-started)
- 公式 — [SQLite](https://orm.drizzle.team/docs/get-started-sqlite)
- 公式 — [Drizzle Kit](https://orm.drizzle.team/docs/kit-overview)
- 公式 — [Migrations](https://orm.drizzle.team/docs/migrations)
- 公式 — [effect-schema（SQLite）](https://orm.drizzle.team/docs/sqlite/effect-schema)
- 公式 — [Batch](https://orm.drizzle.team/docs/batch-api)
- 公式 — [D1 の batch](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch)
- サンプル — [Get Started with D1](https://orm.drizzle.team/docs/get-started/d1-new)
