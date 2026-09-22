---
title: SLI / SLO
description: 成功の割合を測り、目標と誤り予算を決める
---

SLI は、利用者から見て成功した割合である。SLO はその割合の目標で、SLA は外との約束である。誤り予算は目標から外れてよい残りで、その消費速度が burn rate である。入力は [Tracing / Logging / Profiling](/observability/signals) と [Prometheus](/observability/prometheus) が残した、状態コードと処理時間である。アラートの宛先と条件の置き方は [観測性](/guidelines/observability) が持つ。

サービスの外から見るときは RED で、要求の件数（Rate）、失敗（Errors）、所要時間（Duration）である。CPU やディスクのような資源は USE で、使用率（Utilization）、飽和（Saturation）、失敗（Errors）である。

```text
成功 = status < 500 の応答
SLI  = 成功 / 全応答
窓   = 28 日
SLO  = SLI >= 0.999
誤り予算 = 1 - 0.999 = 0.001
```

28 日で 100 万応答なら、誤り予算は 1000 応答である。500 番台が 1000 に達すると、その窓の予算を使い切る。1 時間でその予算の 2% を使うと、同じ速度では窓が終わる前に予算が無くなる。0.999 は目標の例で、どの状態を成功に数えるかはサービスが決める。処理時間で切るときは、成功を「99 分位点が 0.3 秒未満」のように、ヒストグラムの分位点で定義する。

## 参考文献

- 公式 — [Service Level Objectives](https://sre.google/sre-book/service-level-objectives/)
- 公式 — [Implementing SLOs](https://sre.google/workbook/implementing-slos/)
- 公式 — [Alerting on SLOs](https://sre.google/workbook/alerting-on-slos/)
- 公式 — [OpenSLO](https://openslo.com/)
- サンプル — [OpenSLO/OpenSLO](https://github.com/OpenSLO/OpenSLO)
