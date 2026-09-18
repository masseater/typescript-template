# AGENTS.md

- アプリ設定の唯一の定義元。Worker のバインディングと環境変数のスキーマ、デプロイ用のキー一覧、アプリ名とポートと capability、Vite の共通設定と precommit / prepush / premerge のタスク定義、アプリの開発サーバー起動検査（`dev-start` bin）、クライアントの source map を公開物から外す Vite plugin を提供する。
- 技術スタック: Effect 4 (Schema), Vite+ 0.3。
- MUST: 秘匿値のキー名は `src/deployment-keys.ts` に足す。
