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

この式は、直近 5 分の増加分から、処理時間の 99 分位点を秒で返す。0.99 が p99 である。平均は遅い一件を隠すので、それより遅い側は tail latency として分位点で見る。

Counter は増える一方の件数、Gauge は今の値、Histogram はバケットごとの件数である。今動いているプロセス数は減ることがあるので、Counter には乗らない。Native histogram は、境界を固定したバケットをあらかじめ持たない。

ラベルの値の種類が多いと、時系列の本数はその積になる。`user_id` をラベルにすると、利用者の数だけ系列が増える。その識別子は span の属性に置く。OpenTelemetry のメトリクス名 `http.server.request.duration` は、Prometheus ではドットがアンダースコアになり、単位の `_seconds` とバケットの接尾辞 `_bucket` が付く。一つのバケットに、どの trace の標本だったかを残すのが [Exemplars](/observability/exemplars) である。

## 参考文献

- 公式 — [Overview](https://prometheus.io/docs/introduction/overview/)
- 公式 — [Data model](https://prometheus.io/docs/concepts/data_model/)
- 公式 — [Metric types](https://prometheus.io/docs/concepts/metric_types/)
- 公式 — [HTTP metrics](https://opentelemetry.io/docs/specs/semconv/http/http-metrics/)
