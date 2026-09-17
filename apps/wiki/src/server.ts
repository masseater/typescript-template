import { jsonResponse, secureResponse } from "@template/runtime/http";
import { createWikiRuntime } from "@template/runtime/wiki";
import { createWikiSearch } from "./lib/search.ts";
import { handleMcp } from "./lib/mcp.ts";
import handler from "@tanstack/react-start/server-entry";
import { routes } from "./telemetry-routes.ts";

type WikiRuntime = ReturnType<typeof createWikiRuntime>;

interface RequestScope {
  readonly request: Request;
  readonly runtime: WikiRuntime;
  readonly correlation: Parameters<WikiRuntime["reportError"]>[0];
}

const HTTP_BAD_REQUEST = 400;
const HTTP_NOT_FOUND = 404;
const HTTP_INTERNAL_SERVER_ERROR = 500;
const MAX_QUERY_LENGTH = 200;

function requestPath(request: Readonly<Pick<Request, "url">>): string | undefined {
  try {
    return decodeURIComponent(new URL(request.url).pathname);
  } catch {
    return undefined;
  }
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
async function handleApplication(scope: RequestScope, path: string): Promise<Response> {
  const { correlation, request, runtime } = scope;
  const search = createWikiSearch(runtime.embedder(), (failure) => {
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

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
async function handleWithReporting(scope: RequestScope, path: string): Promise<Response> {
  const { correlation, runtime } = scope;
  try {
    return await handleApplication(scope, path);
  } catch (error) {
    runtime.reportError(correlation, error);
    return jsonResponse({ error: "処理に失敗しました。" }, HTTP_INTERNAL_SERVER_ERROR);
  }
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
async function forwardedResponse(scope: RequestScope, path: string): Promise<Response | undefined> {
  const { request, runtime } = scope;
  if (path.endsWith(".map")) {
    return new Response(undefined, { status: HTTP_NOT_FOUND });
  }
  if (path.startsWith("/assets/")) {
    return runtime.config.ASSETS.fetch(request);
  }
  if (path === "/api/telemetry") {
    return runtime.telemetry.ingestBrowser(request);
  }
  if (path === "/api/health") {
    return jsonResponse({ ok: true, release: runtime.config.APP_RELEASE, service: "wiki" });
  }
  return undefined;
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
async function handleRequest(scope: RequestScope): Promise<Response> {
  const path = requestPath(scope.request);
  if (path === undefined) {
    return new Response(undefined, { status: HTTP_BAD_REQUEST });
  }
  return (await forwardedResponse(scope, path)) ?? (await handleWithReporting(scope, path));
}

const worker = {
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  async fetch(request: Request, bindings: unknown): Promise<Response> {
    const runtime = createWikiRuntime(bindings, routes);
    return runtime.telemetry.wrapRequest(
      request,
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
      async (incoming, correlation) => handleRequest({ correlation, request: incoming, runtime }),
    );
  },
};

// oxlint-disable-next-line import/no-default-export
export default worker;
