---
title: Drizzle
description: SQL に近い TypeScript で、SQLite のテーブルとクエリを書く
---

Drizzle は、SQL に近い TypeScript でテーブルとクエリを書く ORM です。テーブル定義が型の出どころで、マイグレーションはその定義から Drizzle Kit が作ります。SQLite を相手にでき、Cloudflare では [D1](/tech-stack/cloudflare) につなぎます。

D1 には、対話的なトランザクションがありません。複数の書き込みを 1 回にまとめるときは batch を使います。

テーブル定義から Effect Schema を作れます。外から来た値を検証してから行の形に合わせる、という [Effect](/tech-stack/effect) の検証と、テーブル定義が分かれません。

## 公式と読みもの

- 公式は [Drizzle ORM](https://orm.drizzle.team/) です。読み始めは [Get started](https://orm.drizzle.team/docs/get-started) と [SQLite](https://orm.drizzle.team/docs/get-started-sqlite)、マイグレーションは [Drizzle Kit](https://orm.drizzle.team/docs/kit-overview) と [Migrations](https://orm.drizzle.team/docs/migrations) です。
- D1 へつなぐ手順のサンプルは [Get Started with D1](https://orm.drizzle.team/docs/get-started/d1-new) です。
- テーブルから Effect Schema を作る話は [effect-schema（SQLite）](https://orm.drizzle.team/docs/sqlite/effect-schema)、まとめて書く話は [Batch](https://orm.drizzle.team/docs/batch-api) です。D1 側で batch が何をするかは [D1 database API](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch) にあります。
