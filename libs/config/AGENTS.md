# AGENTS.md

- アプリ設定の唯一の定義元。Worker のバインディングと環境変数のスキーマ、デプロイ用のキー一覧、アプリ名とポートと capability、Vite の共通設定を提供する。
- 技術スタック: Effect 4 (Schema)。
- MUST: 秘匿値のキー名は `src/deployment-keys.ts` に足す。ログのマスクとデプロイの検査がこの一覧を読む。
