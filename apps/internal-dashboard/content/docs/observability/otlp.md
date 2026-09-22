---
title: OTLP
description: span、メトリクス、ログを同じスキーマで送るプロトコル
---

OTLP は、span、メトリクス、ログを同じスキーマで送るプロトコルである。スキーマは protobuf で、運び方は HTTP のボディか gRPC のメソッドである。HTTP では信号ごとに URL が分かれる。

```http
POST /v1/traces HTTP/1.1
Host: collector.example:4318
content-type: application/json

{"resourceSpans":[{"scopeSpans":[{"spans":[{
  "traceId":"4bf92f3577b34da6a3ce929d0e0e4736",
  "spanId":"00f067aa0ba902b7",
  "name":"user.load"
}]}]}]}
```

`traceId` と `spanId` は [W3C Trace Context](/observability/trace-context) のヘッダと同じ識別子を、16 進の文字列で持つ。メトリクスは `/v1/metrics`、ログは `/v1/logs` へ POST する。ポート 4318 は HTTP、4317 は gRPC の既定である。受けて次へ渡すプロセスは [OpenTelemetry Collector](/observability/collector) である。

## 参考文献

- 公式 — [OTLP](https://opentelemetry.io/docs/specs/otlp/)
- サンプル — [open-telemetry/opentelemetry-proto](https://github.com/open-telemetry/opentelemetry-proto)
