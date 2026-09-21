---
title: OpenTelemetry SDK
description: span を作り、Context で親子を繋ぎ、exporter へ渡すライブラリ
---

OpenTelemetry SDK は、span を作り、Context で親子を繋ぎ、まとめて exporter へ渡す。`startSpan` は span を開く。`end` するまで、その span は開いたままである。子の span は、親を現在の Context に入れたうえで開く。

```ts
import { context, trace } from "@opentelemetry/api";

const tracer = trace.getTracer("users");
const parent = tracer.startSpan("http.server.request");
const child = tracer.startSpan("user.load", undefined, trace.setSpan(context.active(), parent));
child.setAttribute("user.id", "123");
child.end();
parent.end();
```

`user.load` の親は `http.server.request` になる。属性は span が開いている間に付ける。SDK は span を切るだけで、線路上のバイト列にはまだしない。送り出す形式は [OTLP](/observability/otlp) である。このテンプレートのアプリが span を切るときは Effect の `withSpan` で、この `startSpan` を画面から直接は呼ばない。その手順は [OpenTelemetry](/tech-stack/opentelemetry) が持つ。

## 参考文献

- 公式 — [JavaScript](https://opentelemetry.io/docs/languages/js/)
- 公式 — [Trace SDK](https://opentelemetry.io/docs/specs/otel/trace/sdk/)
- 公式 — [Signals](https://opentelemetry.io/docs/concepts/signals/)
- サンプル — [open-telemetry/opentelemetry-js](https://github.com/open-telemetry/opentelemetry-js)
- 記事 — [How to name your spans](https://opentelemetry.io/blog/2025/how-to-name-your-spans/)
