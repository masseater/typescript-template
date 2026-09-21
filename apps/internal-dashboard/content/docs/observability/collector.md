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

この pipeline は、4318 で受けた span をまとめて、別の OTLP HTTP エンドポイントへ出す。`batch` は一件ずつ送らず、溜めてから exporter を呼ぶ。traces と metrics と logs は pipeline を分けられる。

終わった trace を見てから残すのが tail sampling である。span を開いた瞬間に決める head sampling では、遅かった trace を選べない。`decision_wait` のあいだ span を溜め、方針に合うものだけを exporter へ出す。

```yaml
processors:
  tail_sampling:
    decision_wait: 10s
    policies:
      - name: slow
        type: latency
        latency:
          threshold_ms: 1000
      - name: errors
        type: status_code
        status_code:
          status_codes: [ERROR]
```

1 秒を超えた trace と、status が `ERROR` の trace が残る。プロセスをノードごとに置く場所は [Kubernetes](/observability/kubernetes) である。

## 参考文献

- 公式 — [Collector](https://opentelemetry.io/docs/collector/)
- 公式 — [Configuration](https://opentelemetry.io/docs/collector/configuration/)
- 公式 — [Installation](https://opentelemetry.io/docs/collector/installation/)
- サンプル — [open-telemetry/opentelemetry-collector](https://github.com/open-telemetry/opentelemetry-collector)
- サンプル — [tailsamplingprocessor](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/processor/tailsamplingprocessor)
