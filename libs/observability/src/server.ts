import type { RequestContext, RequestHandler, Telemetry } from "./request-span.ts";
import { reportError, wrapRequest } from "./request-span.ts";
import type { IngressRequest } from "./ingress.ts";
import type { LogSink } from "./log.ts";
import type { ServiceName } from "./protocol.ts";
import { consoleSink } from "./log.ts";
import { ingestBrowser } from "./ingress.ts";
import { validateRoutes } from "./protocol.ts";

interface InstrumentationOptions {
  readonly log?: LogSink;
  readonly serviceName: ServiceName;
  readonly release: string;
  readonly routes: Readonly<Record<string, string>>;
}
interface Instrumentation {
  readonly ingestBrowser: (request: IngressRequest) => Promise<Response>;
  readonly reportError: (context: RequestContext, error: unknown) => void;
  readonly wrapRequest: (
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
    request: Request,
    handler: RequestHandler,
  ) => Promise<Response>;
}

const services: ReadonlySet<string> = new Set(["user", "admin", "wiki"]);

function createInstrumentation(options: InstrumentationOptions): Instrumentation {
  if (!/^[a-zA-Z0-9._-]{1,64}$/u.test(options.release)) {
    throw new Error("Invalid release");
  }
  if (!services.has(options.serviceName)) {
    throw new Error("Invalid telemetry service");
  }
  validateRoutes(options.routes);
  const { log = consoleSink, release, routes, serviceName } = options;
  const telemetry: Telemetry = { log, release, routes, serviceName };
  const ingress = {
    labels: new Set([...Object.values(routes), "unmatched"]),
    log,
    release,
    serviceName,
  };
  return {
    ingestBrowser: async (request) => ingestBrowser(ingress, request),
    reportError: (context, error) => {
      reportError(telemetry, context, error);
    },
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
    wrapRequest: async (request, handler) => wrapRequest(telemetry, request, handler),
  };
}

export { createInstrumentation };
export type { Correlation, ServiceName } from "./protocol.ts";
export type { RequestContext } from "./request-span.ts";
export type { Instrumentation, InstrumentationOptions };
