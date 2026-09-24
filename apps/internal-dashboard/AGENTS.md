# AGENTS.md

- 社内ダッシュボード。集計・監査ログ・問い合わせ・機能フラグを扱い、`/wiki` 以下は認証したうえで wiki の Worker へ転送し、`/mcp` で wiki の文書を配る MCP サーバーを公開する。Cloudflare Workers にデプロイし、APP_ORIGIN で公開する。
- wiki の文書は `content/docs` の Markdown に置く。
- 技術スタック: TanStack Start 1, React 19, Effect 4, Tailwind CSS 4。
- MUST: ドキュメント本文は TOTP か passkey を通したセッションにだけ返す。認証なしで返すパスは `src/shared/server-api/access.ts` の `isPublic` が許すものに限る。
