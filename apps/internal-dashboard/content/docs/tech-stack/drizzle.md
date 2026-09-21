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

## マイグレーション

表・列・索引は `sqliteTable` を変えてから `drizzle-kit generate` する。Kit は直前の `snapshot.json` と今のスキーマの差を取り、`migrations/<時刻>_<名前>/` に `migration.sql` と新しい `snapshot.json` を書く。名前を付けるときは `drizzle-kit generate --name=profile` とする。列の削除と追加に見える変更はリネームであることがある。generate の確認でリネームだと答えないと、Kit は列を作り直す。

トリガと、既存の行の書き換えは `sqliteTable` から出ない。スキーマを変えない SQL だけなら `drizzle-kit generate --custom --name=backfill` で空の `migration.sql` を作り、そこへ書く。スキーマの変更と同じタイミングなら、generate が書いた `migration.sql` にその文を足す。`snapshot.json` は手で直さない。直すと、次の generate が同じ差をもう一度出す。

SQLite では、ファイルに書いた複数の文をまとめて実行しない。文のあいだに `--> statement-breakpoint` を置く。

```sql
ALTER TABLE `user` ADD `profile` text DEFAULT '' NOT NULL;
--> statement-breakpoint
UPDATE `user` SET `profile` = '' WHERE `profile` IS NULL;
```

適用済みのフォルダは変えない。`__drizzle_migrations` がフォルダ名と SQL のハッシュを記録していて、中身を変えると一致しなくなる。次の変更は新しいフォルダにする。適用順はフォルダ名の時刻順で、時刻は generate が付ける。`drizzle-kit check` は、同じ snapshot から別々に生成されたマイグレーションの衝突を見る。

## 参考文献

- 公式 — [Drizzle ORM](https://orm.drizzle.team/)
- 公式 — [Get started](https://orm.drizzle.team/docs/get-started)
- 公式 — [SQLite](https://orm.drizzle.team/docs/get-started-sqlite)
- 公式 — [Drizzle Kit](https://orm.drizzle.team/docs/kit-overview)
- 公式 — [Migrations](https://orm.drizzle.team/docs/migrations)
- 公式 — [`generate`](https://orm.drizzle.team/docs/drizzle-kit-generate)
- 公式 — [Custom migrations](https://orm.drizzle.team/docs/kit-custom-migrations)
- 公式 — [effect-schema（SQLite）](https://orm.drizzle.team/docs/sqlite/effect-schema)
- 公式 — [Batch](https://orm.drizzle.team/docs/batch-api)
- 公式 — [D1 の batch](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch)
- サンプル — [Get Started with D1](https://orm.drizzle.team/docs/get-started/d1-new)
