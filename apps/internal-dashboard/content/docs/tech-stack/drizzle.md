---
title: Drizzle
description: SQL に近い TypeScript で SQLite のテーブルとクエリを定義する ORM
---

Drizzle では、テーブル定義が行の型になり、Drizzle Kit がその定義からマイグレーションを生成する。接続先は SQLite で、Cloudflare では [D1](/tech-stack/cloudflare) に繋ぐ。

```ts
const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
});

const rows = await db.select().from(user).where(eq(user.id, id));
```

`rows` の要素は `{ id: string; name: string }` になる。列を変えると、この型と、Kit が出すマイグレーションの両方が変わる。

D1 は、先行する文の結果を見てから次の文を送る対話的なトランザクションを持たない。送る文が先に揃っているときは `batch` にまとめる。

```ts
await db.batch([
  db.insert(user).values({ id, name }),
  db.update(user).set({ name }).where(eq(user.id, id)),
]);
```

テーブルから Effect Schema を出すときは `createSelectSchema(user)` を使う。検証に失敗した値をどこで止めるかは [Effect](/tech-stack/effect) に書く。

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
