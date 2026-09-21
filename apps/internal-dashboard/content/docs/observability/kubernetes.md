---
title: Kubernetes
description: Pod とノードの上で、Collector と受信側のプロキシが動くクラスタ
---

Kubernetes は、Pod とノードの集まりである。観測では、ノードごとに [OpenTelemetry Collector](/observability/collector) を置き、そのノードの Pod が OTLP をそこへ送る。クラスタの外から Pod へ入る宣言は [Gateway API](/observability/gateway-api) が持つ。

```yaml
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: collector
spec:
  selector:
    matchLabels:
      app: collector
  template:
    metadata:
      labels:
        app: collector
    spec:
      containers:
        - name: collector
          image: otel/opentelemetry-collector
          ports:
            - containerPort: 4318
```

DaemonSet は各ノードに Collector を一つ置く。このコンテナが読む設定は [OpenTelemetry Collector](/observability/collector) の pipeline で、アプリの Pod は同じノードの 4318 へ [OTLP](/observability/otlp) を送る。CPU とメモリの使用量は、アプリが出さなくても kubelet がノード上のコンテナから集める。その系列は metrics-server が読む。

CPU の request はスケジューリングの予約で、limit は実行できる時間の上限である。ノード全体の使用率が低くても、limit の枠を使い切るとカーネルがそのコンテナを止め、処理時間が伸びる。これを CPU throttling と呼ぶ。

## 参考文献

- 公式 — [Kubernetes](https://kubernetes.io/docs/concepts/overview/)
- 公式 — [System metrics](https://kubernetes.io/docs/concepts/cluster-administration/system-metrics/)
- 公式 — [Resource metrics pipeline](https://kubernetes.io/docs/tasks/debug/debug-cluster/resource-metrics-pipeline/)
- 公式 — [Manage resources for containers](https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/)
