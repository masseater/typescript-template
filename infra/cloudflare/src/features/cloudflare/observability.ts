import { Workers } from "alchemy/Cloudflare";
import { Effect, Redacted } from "effect";

import { traceDestination } from "./config.ts";
import { prefixedStack } from "./prefixed-stack.ts";
import { otlpAuthorization, settings } from "./settings.ts";

const stack = prefixedStack(
  "observability",
  Effect.gen(function* observability() {
    const config = yield* Effect.orDie(settings);
    const destination = traceDestination(config);
    if (destination === undefined) {
      return { traceDestination: undefined };
    }
    const authorization: Redacted.Redacted | undefined = yield* otlpAuthorization;
    const traces = yield* Workers.ObservabilityDestination("Traces", {
      enabled: true,
      headers: authorization === undefined ? {} : { authorization: Redacted.value(authorization) },
      logpushDataset: "opentelemetry-traces",
      name: destination.name,
      url: destination.url,
    });
    return { traceDestination: traces.name };
  }),
);

export default stack;
