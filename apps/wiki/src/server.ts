import { createWorker, jsonResponse } from "@template/runtime/http";
import { clientErrorSchema } from "@template/observability";
import { createWikiRuntime } from "@template/runtime/wiki";
import { createWikiSearch } from "./lib/search.ts";
import { handleMcp } from "./lib/mcp.ts";
import handler from "@tanstack/react-start/server-entry";
import { is } from "valibot";
import { routes } from "./telemetry-routes.ts";
import { sessionHandler } from "@template/runtime/handlers";

type WikiRuntime = ReturnType<typeof createWikiRuntime>;
type WikiRequestRuntime = ReturnType<WikiRuntime["forRequest"]>;

interface RequestScope {
  readonly context: WikiRequestRuntime;
  readonly correlation: Parameters<WikiRuntime["forRequest"]>[0];
  readonly path: string;
  readonly request: Request;
}

const HTTP_UNAUTHORIZED = 401;
const HTTP_FOUND = 302;
const HTTP_INTERNAL_SERVER_ERROR = 500;
const MAX_QUERY_LENGTH = 200;
const publicPages: ReadonlySet<string> = new Set(["/login", "/consent"]);

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
async function readerStrength({ context, request }: RequestScope): Promise<boolean | undefined> {
  try {
    const reader = await context.session(request, true);
    return reader.strong;
  } catch (error) {
    if (is(clientErrorSchema, error)) {
      return undefined;
    }
    throw error;
  }
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
async function deniedReader(scope: RequestScope): Promise<Response | undefined> {
  const { path } = scope;
  if (publicPages.has(path)) {
    return undefined;
  }
  const strong = await readerStrength(scope);
  if (strong === true || (strong === false && path === "/security")) {
    return undefined;
  }
  if (path.startsWith("/api/") || path.startsWith("/_serverFn/")) {
    return jsonResponse({ error: "ログインしてください。" }, HTTP_UNAUTHORIZED);
  }
  return new Response(undefined, {
    headers: { location: strong === undefined ? "/login" : "/security" },
    status: HTTP_FOUND,
  });
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
async function mcpResponse({ context, request }: RequestScope): Promise<Response> {
  const authorized = await context.authorizeMcp(request);
  if (authorized instanceof Response) {
    return authorized;
  }
  return handleMcp(request, createWikiSearch(context.embedder(), context.reportError));
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
async function protocolResponse(scope: RequestScope): Promise<Response | undefined> {
  const { context, correlation, path, request } = scope;
  if (path.startsWith("/api/auth/") || path.startsWith("/.well-known/oauth-")) {
    return context.auth.handler(request);
  }
  if (path === "/mcp") {
    return mcpResponse(scope);
  }
  if (path === "/api/session") {
    return sessionHandler({ context: { correlation, runtime: context }, request });
  }
  return undefined;
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
async function searchResponse({ context, request }: RequestScope): Promise<Response> {
  const query = new URL(request.url).searchParams.get("query")?.trim() ?? "";
  const search = createWikiSearch(context.embedder(), context.reportError);
  return jsonResponse(query ? await search.search(query.slice(0, MAX_QUERY_LENGTH)) : []);
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
async function readerResponse(scope: RequestScope): Promise<Response> {
  const denied = await deniedReader(scope);
  if (denied !== undefined) {
    return denied;
  }
  if (scope.path === "/api/search") {
    return searchResponse(scope);
  }
  return handler.fetch(scope.request);
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
async function handleApplication(scope: RequestScope): Promise<Response> {
  try {
    return (await protocolResponse(scope)) ?? (await readerResponse(scope));
  } catch (error) {
    scope.context.reportError(error);
    return jsonResponse({ error: "処理に失敗しました。" }, HTTP_INTERNAL_SERVER_ERROR);
  }
}

const worker = createWorker({
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  handle: async (request, { correlation, path, runtime }) => {
    if (path === "/api/health") {
      return jsonResponse({ ok: true, release: runtime.config.APP_RELEASE, service: "wiki" });
    }
    const context = runtime.forRequest(correlation);
    return handleApplication({ context, correlation, path, request });
  },
  runtime: (bindings: unknown) => createWikiRuntime(bindings, routes),
});

// oxlint-disable-next-line import/no-default-export
export default worker;
