---
title: Drizzle
description: SQL に近い TypeScript で SQLite のテーブルとクエリを定義する ORM
---

Drizzle は、SQL に近い TypeScript でテーブルとクエリを書く ORM である。テーブル定義が行の型の源泉になり、マイグレーションは Drizzle Kit がその定義から生成する。対象のデータベースは SQLite であり、Cloudflare ではその実体が [D1](/tech-stack/cloudflare) になる。

D1 には対話的なトランザクションがない。対話的なトランザクションは、先行する文の結果を見てから次の文を送る。複数の書き込みを一つの呼び出しにまとめるときは batch を使う。batch は、複数の文を一度に送り、その組として実行する。

テーブル定義から Effect Schema を生成できる。外部入力の検証と行の形を、テーブル定義とは別のスキーマとして手で二重に書かずに済む。検証の定義は [Effect](/tech-stack/effect) にある。

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
