# web

- テストを 1 つだけ走らせるときは、このワークスペースで `vp test run <ファイル>` を実行する。
- D1 のスキーマは `*.table.ts` に書き、このワークスペースで `vp run db:generate` を実行してマイグレーションを作る。better-auth のテーブルは `vp run auth:generate` で生成する。
