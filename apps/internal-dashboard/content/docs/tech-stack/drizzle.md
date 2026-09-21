---
title: Drizzle
description: SQL に近い TypeScript で SQLite のテーブルとクエリを定義する ORM
---

Drizzle は、SQL に近い TypeScript でテーブルとクエリを定義する ORM である。テーブル定義が型の源泉であり、マイグレーションはその定義から Drizzle Kit が生成する。対象データベースは SQLite であり、Cloudflare では [D1](/tech-stack/cloudflare) に接続する。

D1 は対話的なトランザクションを持たない。複数の書き込みを 1 回の呼び出しにまとめる場合は batch を用いる。

テーブル定義から Effect Schema を生成できる。外部入力の検証と行の形状を、[Effect](/tech-stack/effect) のスキーマとテーブル定義とで分離しない。

## 参照

- 公式ドキュメントは [Drizzle ORM](https://orm.drizzle.team/) である。導入は [Get started](https://orm.drizzle.team/docs/get-started)、SQLite は [SQLite](https://orm.drizzle.team/docs/get-started-sqlite)、マイグレーションは [Drizzle Kit](https://orm.drizzle.team/docs/kit-overview) と [Migrations](https://orm.drizzle.team/docs/migrations) に記載される。
- D1 への接続手順のサンプルは [Get Started with D1](https://orm.drizzle.team/docs/get-started/d1-new) である。
- テーブル定義から Effect Schema を生成する定義は [effect-schema（SQLite）](https://orm.drizzle.team/docs/sqlite/effect-schema)、複数文の一括実行は [Batch](https://orm.drizzle.team/docs/batch-api) に記載される。D1 における batch の意味は [D1 database API](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch) に定義される。
