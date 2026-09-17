import type { DbOperation, ExternalOperation } from "./child-span.ts";
import type { Diagnostics, ExecutionContext } from "./exporter.ts";
import type { RequestContext, Telemetry } from "./telemetry.ts";
import { reportError, wrapRequest } from "./request-span.ts";
import { withDbSpan, withExternalSpan } from "./child-span.ts";
import type { IngressRequest } from "./ingress.ts";
import type { RequestHandler } from "./request-span.ts";
import type { ServiceName } from "./protocol.ts";
import { createExporter } from "./exporter.ts";
import { ingestBrowser } from "./ingress.ts";
import { validateRoutes } from "./protocol.ts";

interface InstrumentationOptions {
  readonly serviceName: ServiceName;
  readonly endpoint: string;
  readonly headers?: Readonly<Record<string, string>>;
  readonly routes: Readonly<Record<string, string>>;
}
interface Instrumentation {
  readonly diagnostics: () => Diagnostics;
  readonly flush: () => Promise<void>;
  readonly ingestBrowser: (
    request: IngressRequest,
    executionContext?: ExecutionContext,
  ) => Promise<Response>;
  readonly reportError: (context: RequestContext, error: unknown) => void;
  readonly withDbSpan: <Result>(
    context: RequestContext,
    operation: DbOperation,
    action: () => Promise<Result>,
  ) => Promise<Result>;
  readonly withExternalSpan: <Result>(
    context: RequestContext,
    operation: ExternalOperation,
    action: (context: RequestContext) => Promise<Result>,
  ) => Promise<Result>;
  readonly wrapRequest: (
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
    request: Request,
    handler: RequestHandler,
    executionContext?: ExecutionContext,
  ) => Promise<Response>;
}

const services: ReadonlySet<string> = new Set(["user", "admin", "wiki"]);

function validateEndpoint(value: string): string {
  const endpoint = new URL(value);
  if (
    !["http:", "https:"].includes(endpoint.protocol) ||
    endpoint.username !== "" ||
    endpoint.password !== "" ||
    endpoint.search !== "" ||
    endpoint.hash !== ""
  ) {
    throw new Error("Invalid OTLP endpoint");
  }
  return endpoint.href.replace(/\/$/u, "");
}

function createInstrumentation(options: InstrumentationOptions): Instrumentation {
  const baseUrl = validateEndpoint(options.endpoint);
  if (!services.has(options.serviceName)) {
    throw new Error("Invalid telemetry service");
  }
  validateRoutes(options.routes);
  const { routes, serviceName } = options;
  const exporter = createExporter({ baseUrl, headers: options.headers, serviceName });
  const telemetry: Telemetry = { exporter, routes, serviceName };
  const ingress = {
    exporter,
    labels: new Set([...Object.values(routes), "unmatched"]),
    serviceName,
  };
  return {
    diagnostics: () => exporter.diagnostics(),
    flush: async () => {
      await exporter.flush();
    },
    ingestBrowser: async (request, executionContext) =>
      ingestBrowser(ingress, request, executionContext),
    reportError: (context, error) => {
      reportError(telemetry, context, error);
    },
    withDbSpan: async (context, operation, action) =>
      withDbSpan(telemetry, operation, { action, context }),
    withExternalSpan: async (context, operation, action) =>
      withExternalSpan(telemetry, operation, { action, context }),
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
    wrapRequest: async (request, handler, executionContext) =>
      wrapRequest(telemetry, request, { executionContext, handler }),
  };
}

export { createInstrumentation };
export type { Correlation, ServiceName } from "./protocol.ts";
export type { ExecutionContext } from "./exporter.ts";
export type { RequestContext } from "./telemetry.ts";
export type { Instrumentation, InstrumentationOptions };
