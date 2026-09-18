import { Effect, Redacted } from "effect";
import { otlpAuthorization, settings } from "./settings.ts";
import { stackName, stackOptions } from "./stacks.ts";
import { Stack } from "alchemy";
import { Workers } from "alchemy/Cloudflare";
import { traceDestination } from "./config.ts";

const stack = Stack(
  stackName("observability"),
  stackOptions,
  Effect.gen(function* observability() {
    const config = yield* Effect.orDie(settings);
    const destination = traceDestination(config);
    if (destination === undefined) {
      return { traceDestination: undefined };
    }
    const authorization: Redacted.Redacted | undefined = yield* otlpAuthorization;
    const traces = yield* Workers.ObservabilityDestination("Traces", {
      ...destination,
      headers: authorization === undefined ? {} : { authorization: Redacted.value(authorization) },
      logpushDataset: "opentelemetry-traces",
    });
    return { traceDestination: traces.name };
  }),
);

// oxlint-disable-next-line import/no-default-export
export default stack;
