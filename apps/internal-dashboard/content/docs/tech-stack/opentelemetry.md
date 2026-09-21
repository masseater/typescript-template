---
title: OpenTelemetry
description: 処理の区間を span にし、同じ trace id のログと一緒に OTLP で送る
---

OpenTelemetry は、トレース、メトリクス、ログを一つのモデルで表し、OTLP で送る。トレースは span の木で、一本の trace id を共有する。span は名前と、開始から終了までの区間と、親の span id を持つ。ログは別の信号で、同じ trace id を持てる。この送り出しはトレースとログで、どちらも OTLP の JSON である。何を記録するかと深刻さは [観測性](/guidelines/observability) が持つ。

サーバーでは `effect/unstable/observability` の `OtlpTracer` と `OtlpLogger` が、`{endpoint}/v1/traces` と `{endpoint}/v1/logs` へ出す。リソースにはサービス名と版を載せる。タイマーでは送らない。`flushTelemetry` が溜めた分を送る。[Cloudflare](/tech-stack/cloudflare) では応答を返したあとに isolate が止まりうるので、応答を返せたときはその flush を `waitUntil` に渡す。エンドポイントが無いときは OTLP へ出さず、構造化ログの行だけが残る。

リクエストの区間は `observeRequest` が `http.server.request` という server span として開く。来た `traceparent` が [W3C Trace Context](https://www.w3.org/TR/trace-context/) として読めるときは、その span を親にする。読めなければ新しい trace id を切る。子の区間は `withSpan` で切る。属性名が `authorization` や `token` に当たる値は、span に載せる前に `[redacted]` へ置き換わる。`Effect.withSpan` へ直接渡すと、この置換を通らない。

```ts
const request = new Request("https://app.example/users/123", {
  headers: {
    traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
  },
});

const handle = (_request: Request) =>
  Effect.succeed({ id: "123" }).pipe(
    Effect.map((user) => Response.json(user)),
    withSpan("user.load", { attributes: { "user.id": "123" } }),
  );

const program = observeRequest(request, handle);
```

`program` を作った時点では span は開かない。`runPromise` すると `http.server.request` が開き、`handle` はその中で走る。trace id `4bf92f3577b34da6a3ce929d0e0e4736` を引き継ぎ、親 span は `00f067aa0ba902b7` になる。`user.load` はその子である。応答の `traceparent` は同じ trace id と、この server span の span id を持ち、末尾の `01` は sampled を表す。同じリクエストのログにもその trace id が付く。実行には `Telemetry` の Layer が要る。Layer が tracer と logger を渡す。

ブラウザの計測は OTLP ではない。同じオリジンの `/api/telemetry` へ JSON を送り、同じオリジンへの `fetch` には `traceparent` を付ける。サーバー側の span は、そのヘッダを親として同じ trace id を続ける。

## 参考文献

- 公式 — [OpenTelemetry](https://opentelemetry.io/docs/what-is-opentelemetry/)
- 公式 — [Signals](https://opentelemetry.io/docs/concepts/signals/)
- 公式 — [Traces](https://opentelemetry.io/docs/concepts/signals/traces/)
- 公式 — [Logs](https://opentelemetry.io/docs/concepts/signals/logs/)
- 公式 — [Metrics](https://opentelemetry.io/docs/concepts/signals/metrics/)
- 公式 — [Context propagation](https://opentelemetry.io/docs/concepts/context-propagation/)
- 公式 — [OTLP](https://opentelemetry.io/docs/specs/otlp/)
- 公式 — [W3C Trace Context](https://www.w3.org/TR/trace-context/)
- 公式 — [JavaScript](https://opentelemetry.io/docs/languages/js/)
- 公式 — [Effect · Tracing](https://effect.website/docs/v4/observability/tracing/)
- 公式 — [Exporting OpenTelemetry data](https://developers.cloudflare.com/workers/observability/exporting-opentelemetry-data/)
- サンプル — [open-telemetry/opentelemetry-js](https://github.com/open-telemetry/opentelemetry-js)
- サンプル — [open-telemetry/opentelemetry-demo](https://github.com/open-telemetry/opentelemetry-demo)
- 記事 — [How to name your spans](https://opentelemetry.io/blog/2025/how-to-name-your-spans/)
- 記事 — [How to name your span attributes](https://opentelemetry.io/blog/2025/how-to-name-your-span-attributes/)
