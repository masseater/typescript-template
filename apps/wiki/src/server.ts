import { jsonResponse, secureResponse } from "@template/runtime/http";
import { createWikiRuntime } from "@template/runtime/wiki";
import { createWikiSearch } from "./lib/search.ts";
import { handleMcp } from "./lib/mcp.ts";
import handler from "@tanstack/react-start/server-entry";
import { routes } from "./telemetry-routes.ts";
import { withSentryRequest } from "@template/observability/sentry-server";

type WorkerExecutionContext = Readonly<{
  waitUntil: (promise: Promise<unknown>) => void;
  passThroughOnException: () => void;
}>;
type WikiRuntime = ReturnType<typeof createWikiRuntime>;

interface RequestScope {
  readonly request: Request;
  readonly runtime: WikiRuntime;
  readonly correlation: Parameters<WikiRuntime["reportError"]>[0];
  readonly executionContext: WorkerExecutionContext;
}

const HTTP_INTERNAL_SERVER_ERROR = 500;
const MAX_QUERY_LENGTH = 200;

function requestPath(request: Request): string | undefined {
  try {
    return decodeURIComponent(new URL(request.url).pathname);
  } catch {
    return undefined;
  }
}

async function handleApplication(scope: RequestScope, path: string): Promise<Response> {
  const { correlation, request, runtime } = scope;
  const search = createWikiSearch(runtime.embedder(correlation), (failure) => {
    runtime.reportError(correlation, failure);
  });
  if (path === "/api/search") {
    const query = new URL(request.url).searchParams.get("query")?.trim() ?? "";
    return jsonResponse(query ? await search.search(query.slice(0, MAX_QUERY_LENGTH)) : []);
  }
  if (path === "/mcp") {
    return secureResponse(await handleMcp(request, search));
  }
  return secureResponse(await handler.fetch(request));
}

async function handleWithReporting(scope: RequestScope, path: string): Promise<Response> {
  const { correlation, executionContext, request, runtime } = scope;
  async function action(): Promise<Response> {
    return handleApplication(scope, path);
  }
  try {
    return await (runtime.config.sentry
      ? withSentryRequest({
          action,
          configuration: runtime.config.sentry,
          context: executionContext,
          correlation,
          request,
        })
      : action());
  } catch (error) {
    runtime.reportError(correlation, error);
    return jsonResponse({ error: "処理に失敗しました。" }, HTTP_INTERNAL_SERVER_ERROR);
  }
}

function localResponse(runtime: WikiRuntime, path: string): Response | undefined {
  if (path.endsWith(".map")) {
    return new Response(undefined, { status: 404 });
  }
  if (path === "/api/client-config") {
    return jsonResponse({ sentry: runtime.config.sentry });
  }
  return undefined;
}

async function forwardedResponse(scope: RequestScope, path: string): Promise<Response | undefined> {
  const { executionContext, request, runtime } = scope;
  if (path.startsWith("/assets/")) {
    return runtime.config.ASSETS.fetch(request);
  }
  if (path === "/api/telemetry") {
    return runtime.telemetry.ingestBrowser(request, executionContext);
  }
  return undefined;
}

async function handleRequest(scope: RequestScope): Promise<Response> {
  const path = requestPath(scope.request);
  if (path === undefined) {
    return new Response(undefined, { status: 400 });
  }
  return (
    localResponse(scope.runtime, path) ??
    (await forwardedResponse(scope, path)) ??
    (await handleWithReporting(scope, path))
  );
}

const worker = {
  async fetch(
    request: Request,
    bindings: unknown,
    executionContext: WorkerExecutionContext,
  ): Promise<Response> {
    const runtime = createWikiRuntime(bindings, routes);
    return runtime.telemetry.wrapRequest(
      request,
      async (incoming, correlation) =>
        handleRequest({ correlation, executionContext, request: incoming, runtime }),
      executionContext,
    );
  },
};

export default worker;
