# AGENTS.md

- 管理者向けの Web アプリ。Cloudflare Workers にデプロイし、APP_ORIGIN で誰でも到達できる場所に公開する。
- 技術スタック: TanStack Start 1, React 19, Effect 4, Tailwind CSS 4。
- MUST: 管理者だけに許す DB 操作は `@repo/db/admin` を通す。このアプリだけがこのエントリーポイントを読める。
