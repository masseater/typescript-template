# AGENTS.md

- 認証と認可を提供する。better-auth のインスタンス生成、セッション検証、OAuth プロバイダーと MCP、passkey、TOTP のプラグイン構成を持つ。
- 技術スタック: better-auth 1, Effect 4。
- MUST: `@better-auth/oauth-provider` は `patches/` のパッチ適用を前提に動く。バージョンを上げるときはパッチを作り直す。
