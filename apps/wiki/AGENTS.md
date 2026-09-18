# AGENTS.md

- このリポジトリのドキュメントサイト。`content/docs` の MDX を配信し、`/mcp` で MCP サーバーを公開する。Cloudflare Workers にデプロイする。
- 技術スタック: TanStack Start 1, React 19, fumadocs 16, Effect 4, Tailwind CSS 4。
- MUST: ドキュメント本文は TOTP か passkey を通したセッションにだけ返す。認証なしで返すパスは `src/shared/server-api/access.ts` の publicPaths に限る。
