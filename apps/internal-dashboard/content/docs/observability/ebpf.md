---
title: eBPF
description: カーネルにプログラムを載せ、プロセスを書き換えずに通信を span にする
---

eBPF は、カーネルに小さいプログラムを載せ、パケットとシステムコールをプロセスの外から見る。OpenTelemetry eBPF Instrumentation は、対応するプロセスの HTTP を span とメトリクスにし、アプリのバイナリも設定も変えない。見えた通信は [OTLP](/observability/otlp) で Collector へ出す。

```yaml
containers:
  - name: obi
    image: otel/ebpf-instrument
    env:
      - name: OTEL_EBPF_OPEN_PORT
        value: "8443"
      - name: OTEL_EBPF_TRACE_PRINTER
        value: text
    securityContext:
      privileged: true
```

HTTP のバイト列を見るほかに、kprobe はカーネルの関数、uprobe はプロセスの関数へフックする。`OTEL_EBPF_OPEN_PORT` は、そのポートを開いているプロセスを対象にする。`OTEL_EBPF_TRACE_PRINTER=text` は、見えた HTTP を標準出力へ書く。他のコンテナのプロセスを見るには、ホストの PID 名前空間が要る。`privileged` は、プローブをカーネルへ載せるために要る。Linux の `amd64` と `arm64` で、カーネルは 5.8 以降が前提である。OTLP の送り先は別に設定し、Collector へ出せる。プロトコルの外にある値、たとえば処理の途中の変数は、このプローブには見えない。件数と分布として残す先は [Prometheus](/observability/prometheus) である。

## 参考文献

- 公式 — [What is eBPF?](https://ebpf.io/what-is-ebpf/)
- 公式 — [OpenTelemetry eBPF Instrumentation](https://opentelemetry.io/docs/zero-code/obi/)
- 公式 — [Set up OBI](https://opentelemetry.io/docs/zero-code/obi/setup/)
- 公式 — [Run OBI as a Docker container](https://opentelemetry.io/docs/zero-code/obi/setup/docker/)
- サンプル — [open-telemetry/opentelemetry-ebpf-instrumentation](https://github.com/open-telemetry/opentelemetry-ebpf-instrumentation)
