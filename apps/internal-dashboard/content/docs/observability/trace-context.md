---
title: W3C Trace Context
description: HTTP ヘッダで trace id と親 span id を次のプロセスへ渡す仕様
---

W3C Trace Context は、HTTP ヘッダで trace id と親の span id を次のプロセスへ渡す。受けた側は、その trace id の子として自分の span を開く。ヘッダが無い、または形式を満たさないときは、新しい trace id を切る。

```http
traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01
```

`00` は版、次の 32 桁が trace id、次の 16 桁が親の span id、末尾の `01` は sampled である。この要求の処理を span にする側は、応答の `traceparent` に同じ trace id と自分の span id を載せる。別のキーを同じ経路で渡すヘッダは `baggage` で、trace id とは別である。span を開いてこのヘッダを読む処理の形は [OpenTelemetry SDK](/observability/opentelemetry-sdk) が持ち、このテンプレートでの読み方は [OpenTelemetry](/tech-stack/opentelemetry) が持つ。

## 参考文献

- 公式 — [W3C Trace Context](https://www.w3.org/TR/trace-context/)
- 公式 — [W3C Baggage](https://www.w3.org/TR/baggage/)
- 公式 — [Context propagation](https://opentelemetry.io/docs/concepts/context-propagation/)
