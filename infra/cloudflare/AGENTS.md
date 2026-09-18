# AGENTS.md

- Cloudflare のリソースを Alchemy で定義し、デプロイ・計画表示・アカウントと成果物の検査を行う。
- 技術スタック: Alchemy 2, Effect 4, Cloudflare Workers。
- MUST: 状態ファイルとデプロイ用トークンの扱いは `src/state-ownership.ts` と `src/deploy-token.ts` に閉じる。
