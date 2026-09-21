---
title: SLI / SLO
description: 成功の割合を測り、目標と誤り予算を決める
---

SLI は、利用者から見て成功した割合である。SLO はその割合の目標で、誤り予算は目標から外れてよい残りである。入力は [Tracing / Logging / Profiling](/observability/signals) と [Prometheus](/observability/prometheus) が残した、状態コードと処理時間である。アラートの宛先と条件の置き方は [観測性](/guidelines/observability) が持つ。

```text
成功 = status < 500 の応答
SLI  = 成功 / 全応答
窓   = 28 日
SLO  = SLI >= 0.999
誤り予算 = 1 - 0.999 = 0.001
```

28 日で 100 万応答なら、誤り予算は 1000 応答である。500 番台が 1000 に達すると、その窓の予算を使い切る。0.999 は目標の例で、どの状態を成功に数えるかはサービスが決める。処理時間で切るときは、成功を「99 分位点が 0.3 秒未満」のように、ヒストグラムの分位点で定義する。

## 参考文献

- 公式 — [Service Level Objectives](https://sre.google/sre-book/service-level-objectives/)
- 公式 — [Implementing SLOs](https://sre.google/workbook/implementing-slos/)
- 公式 — [OpenSLO](https://openslo.com/)
- サンプル — [OpenSLO/OpenSLO](https://github.com/OpenSLO/OpenSLO)
