import { jsonResponse, secureResponse } from "@template/runtime/http";
import { createRuntime } from "@template/runtime";
import handler from "@tanstack/react-start/server-entry";
import { routes } from "#telemetry-routes.ts";
import { withSentryRequest } from "@template/observability/sentry-server";

type Runtime = ReturnType<typeof createRuntime>;
type Correlation = Readonly<Parameters<Runtime["forRequest"]>[0]>;
type WorkerContext = Readonly<{
  passThroughOnException: () => void;
  waitUntil: (promise: Readonly<PromiseLike<unknown>>) => void;
}>;

function requestPath(url: string): string | undefined {
  try {
    return decodeURIComponent(new URL(url).pathname);
  } catch {
    return undefined;
  }
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
function infrastructureResponse({
  executionContext,
  incoming,
  path,
  runtime,
}: Readonly<{
  executionContext: WorkerContext;
  incoming: Request;
  path: string;
  runtime: Runtime;
}>): Promise<Response> | Response | undefined {
  if (path.endsWith(".map")) {
    return new Response(undefined, { status: 404 });
  }
  if (path.startsWith("/assets/")) {
    return runtime.config.ASSETS.fetch(incoming);
  }
  if (path === "/api/telemetry") {
    return runtime.telemetry.ingestBrowser(incoming, executionContext);
  }
  if (path === "/api/client-config") {
    return jsonResponse({ sentry: runtime.config.sentry });
  }
  return undefined;
}

async function serve(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  request: Request,
  bindings: unknown,
  executionContext: WorkerContext,
): Promise<Response> {
  const runtime = createRuntime(bindings, "user", routes);

  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  async function route(incoming: Request, correlation: Correlation): Promise<Response> {
    const path = requestPath(incoming.url);
    if (path === undefined) {
      return new Response(undefined, { status: 400 });
    }
    const infrastructure = infrastructureResponse({ executionContext, incoming, path, runtime });
    if (infrastructure !== undefined) {
      return infrastructure;
    }
    async function renderApplication(): Promise<Response> {
      const response = await handler.fetch(incoming, {
        context: { correlation, runtime: runtime.forRequest(correlation) },
      });
      return secureResponse(response);
    }
    const { sentry } = runtime.config;
    return sentry
      ? withSentryRequest({
          action: renderApplication,
          configuration: sentry,
          context: executionContext,
          correlation,
          request: incoming,
        })
      : renderApplication();
  }

  return runtime.telemetry.wrapRequest(request, route, executionContext);
}

const worker = { fetch: serve };

// oxlint-disable-next-line import/no-default-export
export default worker;
