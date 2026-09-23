import { SpanStatusCode, context, trace } from "@opentelemetry/api";
import { inheritedContext, startTelemetry } from "@repo/ai-native-telemetry";

import { path } from "../platform/path.ts";

const INSTRUMENTATION_NAME = "@repo/dont-review-it/repository-checks";

const SERVICE_NAME = "mst-check";

const invocationName = (): string =>
  [path.basename(process.argv[1] ?? SERVICE_NAME), ...process.argv.slice(2)].join(" ");

export const measureCheck = <Produced>(
  run: () => Produced | Promise<Produced>,
): Promise<Awaited<Produced>> => {
  if (!startTelemetry(SERVICE_NAME).enabled) {
    return Promise.try(run);
  }
  return context.with(inheritedContext(), () =>
    trace.getTracer(INSTRUMENTATION_NAME).startActiveSpan(invocationName(), (span) => {
      const measured = Promise.try(run);
      void measured.catch((failure: unknown) => {
        const exception = failure instanceof Error ? failure : String(failure);
        span.recordException(exception);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: typeof exception === "string" ? exception : exception.message,
        });
      });
      return measured.finally(() => {
        span.end();
      });
    }),
  );
};
