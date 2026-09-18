# AGENTS.md

- DB スキーマ・マイグレーション・DB 操作と、管理者用の操作（`@repo/db/admin`）を提供する。
- 技術スタック: Drizzle ORM 1, Cloudflare D1 (SQLite), Effect 4。
- MUST: DB 定義とマイグレーションをこのパッケージで管理する。
- MUST NOT: Web アプリから SQL ドライバーや管理者専用の内部実装を直接呼び出す。
- IF: PostgreSQL に切り替える; THEN MUST: 次の手順を実施する。
  1. 接続とスキーマを PostgreSQL 用の Drizzle 定義へ置き換える。ユーザー情報操作の公開契約を維持する。
  2. SQLite のトリガーが保証する最終管理者保護とセッション失効を PostgreSQL でも保証する。
  3. PostgreSQL 用のマイグレーションと既存データの移行処理を作成する。適用済みの SQLite マイグレーションは書き換えない。
  4. 認証アダプターの方言と実 DB テストを PostgreSQL に変更する。
  5. 設定・ローカルサービス・インフラの DB 接続を変更する。認証・権限・並行更新・永続化のテストを実 DB で通す。
