---
description: One OpenTelemetry provider startup for a process.
---

# @repo/telemetry

## このパッケージが守るもの

1 プロセスにつき OpenTelemetry の provider を 1 回だけ立ち上げる。最初に呼んだ側が `service.name` を決める。有効化は `MST_TELEMETRY`、送信先は `OTEL_EXPORTER_OTLP_ENDPOINT`、停止は `OTEL_SDK_DISABLED` が決める。

- IF: 計測を仕込む; THEN
  - MUST: 時間を使っている当人に仕込む
  - PROHIBIT: 計測のためだけにコマンドを包む
- IF: プロセスの終了前に片付けたいものがある; THEN
  - MUST: `beforeExit` に自分で登録する
  - PROHIBIT: 送信の停止処理より先に登録されることを前提にする

エントリは `.`・`./optional-setting`・`./vitest-sdk` である。コマンドは持たない。npm へは直接出さず、公開パッケージのビルドに束ねられて出る。

OpenTelemetry API 1。Logs / metrics / trace の SDK は package.json の pin に従う。
