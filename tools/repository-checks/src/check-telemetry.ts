import { basename } from "node:path";

import { context, trace } from "@opentelemetry/api";
import { inheritedContext, startTelemetry } from "@repo/ai-native/telemetry";

const INSTRUMENTATION_NAME = "@repo/repository-checks";

const SERVICE_NAME = "mst-check";

const invocationName = (): string =>
  [basename(process.argv[1] ?? SERVICE_NAME), ...process.argv.slice(2)].join(" ");

export const measureCheck = async <Produced>(
  run: () => Produced | Promise<Produced>,
): Promise<Produced> => {
  if (!startTelemetry(SERVICE_NAME).enabled) {
    return run();
  }
  return context.with(inheritedContext(), async () =>
    trace.getTracer(INSTRUMENTATION_NAME).startActiveSpan(invocationName(), async (span) => {
      const produced = await run();
      span.end();
      return produced;
    }),
  );
};
