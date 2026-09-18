# AGENTS.md

- 構造化ログ・トレース・Web Vitals の送出を提供する。サーバー用とブラウザ用で入口が分かれる。
- 技術スタック: OpenTelemetry (OTLP), Effect 4。
- MUST: 外へ出す文字列は `src/redact.ts` を通す。秘匿値の判定は `@repo/config/deployment-keys` の一覧に従う。
