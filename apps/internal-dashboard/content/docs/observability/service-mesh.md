---
title: Service Mesh
description: Pod の隣の Envoy が、クラスタ内の通信に span を付ける
---

Service Mesh は、Pod の隣にプロキシを置き、クラスタ内の通信をそこへ通す。データ面のプロキシは Envoy で、Istio はその Envoy に設定を配る。プロセスが自分で span を開かなくても、Envoy は受けた要求と、次へ出した要求を span にする。

```http
GET /users/123 HTTP/1.1
Host: users
traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01
```

この `traceparent` は、上流の Pod が書いたものとは限らない。隣の Envoy が、入ってきた span の子として新しい span id を切り、上流へ付けて送る。応答が返ると、Envoy はその span を [OTLP](/observability/otlp) で Collector へ出す。プロセスの中を通らない通信を、プロキシにもアプリにも触らせず見るのが [eBPF](/observability/ebpf) である。

## 参考文献

- 公式 — [What is Istio?](https://istio.io/latest/docs/concepts/what-is-istio/)
- 公式 — [Distributed tracing](https://istio.io/latest/docs/tasks/observability/distributed-tracing/overview/)
- 公式 — [What is Envoy?](https://www.envoyproxy.io/docs/envoy/latest/intro/what_is_envoy)
- 公式 — [Envoy observability](https://www.envoyproxy.io/docs/envoy/latest/intro/arch_overview/observability/observability)
