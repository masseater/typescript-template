---
title: OpenTelemetry Collector
description: OTLP を受け、加工し、別の送り先へ出すプロセス
---

OpenTelemetry Collector は、OTLP を受け、加工し、別の送り先へ出すプロセスである。入口が receiver、加工が processor、出口が exporter で、service の pipeline が三つを信号ごとに繋ぐ。

```yaml
receivers:
  otlp:
    protocols:
      http:
        endpoint: 0.0.0.0:4318
processors:
  batch: {}
exporters:
  otlphttp:
    endpoint: https://backend.example:4318
service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [batch]
      exporters: [otlphttp]
```

この pipeline は、4318 で受けた span をまとめて、別の OTLP HTTP エンドポイントへ出す。`batch` は一件ずつ送らず、溜めてから exporter を呼ぶ。traces と metrics と logs は pipeline を分けられる。プロセスをノードごとに置く場所は [Kubernetes](/observability/kubernetes) である。

## 参考文献

- 公式 — [Collector](https://opentelemetry.io/docs/collector/)
- 公式 — [Configuration](https://opentelemetry.io/docs/collector/configuration/)
- 公式 — [Installation](https://opentelemetry.io/docs/collector/installation/)
- サンプル — [open-telemetry/opentelemetry-collector](https://github.com/open-telemetry/opentelemetry-collector)
