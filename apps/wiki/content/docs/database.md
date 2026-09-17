---
title: データベース
description: D1 のスキーマ定義とマイグレーションの扱い方です。
---

## スキーマを変更する

テーブル定義は `libs/db/src/schema.ts` の Drizzle 定義で管理します。定義を書き換えたら、差分から SQL を生成します。

```bash
vp run --filter @template/db db:generate
vp run --filter @template/db db:check
vp run --filter @template/db db:migrate:local
```

## 注意すること

適用済みのマイグレーションファイルは書き換えません。修正が必要なときは新しいマイグレーションを追加します。

Web アプリから SQL ドライバーを直接呼び出すことは lint で禁止しています。DB 操作は計測付きの ORM を経由します。
