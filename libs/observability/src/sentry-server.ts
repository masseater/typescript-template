import { captureException, getClient, setTag } from "@sentry/cloudflare";
import type { RequestContext } from "./server.ts";
import type { SentryConfiguration } from "./sentry.ts";
import { sentryBoundary } from "./sentry.ts";
import { wrapRequestHandler } from "@sentry/cloudflare/request";

interface SentryRequest {
  readonly configuration: SentryConfiguration;
  readonly request: Request;
  readonly context: Parameters<typeof wrapRequestHandler>[0]["context"];
  readonly correlation: RequestContext;
  readonly action: () => Promise<Response>;
}

async function withSentryRequest(input: SentryRequest): Promise<Response> {
  const { action, context, correlation, request } = input;
  const options = sentryBoundary(input.configuration);
  if (!options.enabled) {
    return action();
  }
  return wrapRequestHandler(
    { context, options: { ...options, skipOpenTelemetrySetup: true }, request },
    async () => {
      setTag("request_id", correlation.requestId);
      setTag("otel_trace_id", correlation.traceId);
      return action();
    },
  );
}

function reportSentryError(error: unknown): void {
  if (getClient()) {
    captureException(error);
  }
}

export { reportSentryError, withSentryRequest };
