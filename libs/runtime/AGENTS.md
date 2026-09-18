# AGENTS.md

- アプリのサーバー実装の土台。Elysia の HTTP ルーター、Eden の型付きクライアント、Effect のレイヤー合成を提供する。
- 技術スタック: Elysia 1, Effect 4。
- MUST: サーバーとクライアントが共有する API の型は `src/contracts.ts` に置く。
