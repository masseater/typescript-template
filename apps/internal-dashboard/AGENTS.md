# AGENTS.md

- このリポジトリのドキュメントサイト。`content/docs` の Markdown を `/wiki` で静的に配信し、`/mcp` で MCP サーバーを公開する。Cloudflare Workers にデプロイし、APP_ORIGIN で公開する。ダッシュボード本体（`/` 配下）だけ強い認証を要る。
- 技術スタック: TanStack Start 1, React 19, fumadocs 16, Effect 4, Tailwind CSS 4。
- MUST: `/wiki` の文書は認証なしで返す。ダッシュボードと API などそれ以外は `src/shared/server-api/access.ts` の `isPublic` が許すもの以外に認証なしで返さない。
