import { wrapRequestHandler } from "@sentry/cloudflare/request";
import { captureException, getClient, setTag } from "@sentry/cloudflare";
import { sentryBoundary } from "./sentry.ts";
import type { SentryConfiguration } from "./sentry.ts";
import type { RequestContext } from "./server.ts";

export function withSentryRequest(
  configuration: SentryConfiguration,
  request: Request,
  context: Parameters<typeof wrapRequestHandler>[0]["context"],
  correlation: RequestContext,
  action: () => Promise<Response>,
): Promise<Response> {
  const options = sentryBoundary(configuration);
  if (!options.enabled) return action();
  return wrapRequestHandler(
    { options: { ...options, skipOpenTelemetrySetup: true }, request, context },
    () => {
      setTag("request_id", correlation.requestId);
      setTag("otel_trace_id", correlation.traceId);
      return action();
    },
  );
}

export function reportSentryError(error: unknown): void {
  if (getClient()) captureException(error);
}
