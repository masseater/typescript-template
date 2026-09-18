# AGENTS.md

vp の実行を、プロセス・タスク・テスト単位の OpenTelemetry のトレースとして記録し、Tempo から読み戻して実行同士を比較する計測基盤。

- OpenTelemetry JS SDK 2 / OTLP exporter 0.222 / Effect 4 / Vitest 4
- MUST NOT: 計測の実行中にワークスペースの中へファイルを書く。
