---
title: Prometheus
description: ラベル付きの時系列を引き、分位点を計算する
---

Prometheus は、ラベル付きの時系列を保存し、PromQL で読む。スクレイプは、相手が今持っている標本を Prometheus が引きに行く。HTTP のサーバ処理時間はヒストグラムで、バケットごとの件数から分位点を計算する。

```promql
histogram_quantile(
  0.99,
  sum by (le) (rate(http_server_request_duration_seconds_bucket[5m]))
)
```

この式は、直近 5 分の増加分から、処理時間の 99 分位点を秒で返す。OpenTelemetry のメトリクス名 `http.server.request.duration` は、Prometheus ではドットがアンダースコアになり、単位の `_seconds` とバケットの接尾辞 `_bucket` が付く。一つのバケットに、どの trace の標本だったかを残すのが [Exemplars](/observability/exemplars) である。

## 参考文献

- 公式 — [Overview](https://prometheus.io/docs/introduction/overview/)
- 公式 — [Data model](https://prometheus.io/docs/concepts/data_model/)
- 公式 — [Metric types](https://prometheus.io/docs/concepts/metric_types/)
- 公式 — [HTTP metrics](https://opentelemetry.io/docs/specs/semconv/http/http-metrics/)
