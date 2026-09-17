import { readWikiConfig } from "@template/config";
import { createInstrumentation } from "@template/observability";
import type { RequestContext } from "@template/observability";
import { reportSentryError } from "@template/observability/sentry-server";

export function createWikiRuntime(bindings: unknown, routes: Readonly<Record<string, string>>) {
  const config = readWikiConfig(bindings);
  const telemetry = createInstrumentation({
    serviceName: "wiki",
    endpoint: config.OTEL_EXPORTER_OTLP_ENDPOINT,
    headers: config.otelHeaders,
    routes,
  });
  return {
    config: { ASSETS: config.ASSETS, APP_ORIGIN: config.APP_ORIGIN, sentry: config.sentry },
    telemetry,
    reportError(correlation: RequestContext, error: unknown) {
      telemetry.reportError(correlation, error);
      if (config.sentry) reportSentryError(error);
    },
  };
}
