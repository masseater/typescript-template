---
title: Exemplars
description: メトリクスの一点に、その標本の trace id を添える
---

Exemplar は、メトリクスの一点に、その標本がどの span だったかを添える。ヒストグラムのバケットは件数しか持たないので、99 分位点が遅いことまでは分かっても、どの要求が遅かったかは分からない。Exemplar がその一件の trace id を残す。

```text
http_server_request_duration_seconds_bucket{le="0.1"} 8 # {trace_id="4bf92f3577b34da6a3ce929d0e0e4736",span_id="00f067aa0ba902b7"} 0.042
```

`#` の前がバケットの件数で、`#` の後が exemplar である。`0.042` は、そのバケットに入った一件の秒数で、`trace_id` はその件のトレースである。OpenTelemetry のメトリクスデータモデルでも、データ点は exemplar として trace id と span id を持てる。

p99 が悪化したときは、そのバケットの exemplar の trace id を開く。開いた span の子に遅いデータベースの span があれば、分位点の悪化がその一件に結び付く。その先の記録は [Tracing / Logging / Profiling](/observability/signals) である。

## 参考文献

- 公式 — [Metrics data model](https://opentelemetry.io/docs/specs/otel/metrics/data-model/#exemplars)
- 公式 — [OpenMetrics](https://github.com/prometheus/OpenMetrics/blob/main/specification/OpenMetrics.md)
- 公式 — [Prometheus feature flags](https://prometheus.io/docs/prometheus/latest/feature_flags/)
