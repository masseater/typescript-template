# AGENTS.md

- アプリのサーバー実装の基盤。Elysia の HTTP ルーター、Eden の型付きクライアント、Effect のレイヤー合成を提供する。
- 技術スタック: Elysia 2, Effect 4。
- MUST: サーバーとクライアントが共有する API の型は `src/features/runtime/contracts.ts` に置く。
