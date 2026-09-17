import { apiResponse, jsonResponse, secureResponse } from "@template/runtime/http";
import { createWikiRuntime } from "@template/runtime/wiki";
import { createWikiSearch } from "./lib/search.ts";
import { handleMcp } from "./lib/mcp.ts";
import handler from "@tanstack/react-start/server-entry";
import { routes } from "./telemetry-routes.ts";

type WikiRuntime = ReturnType<typeof createWikiRuntime>;
type WikiRequestRuntime = ReturnType<WikiRuntime["forRequest"]>;

interface IncomingScope {
  readonly correlation: Parameters<WikiRuntime["forRequest"]>[0];
  readonly request: Request;
  readonly runtime: WikiRuntime;
}

interface RequestScope extends IncomingScope {
  readonly context: WikiRequestRuntime;
}

const HTTP_BAD_REQUEST = 400;
const HTTP_UNAUTHORIZED = 401;
const HTTP_NOT_FOUND = 404;
const HTTP_FOUND = 302;
const HTTP_CLIENT_ERROR_END = 500;
const HTTP_INTERNAL_SERVER_ERROR = 500;
const MAX_QUERY_LENGTH = 200;
const publicPages: ReadonlySet<string> = new Set(["/login", "/consent"]);

function requestPath(request: Readonly<Pick<Request, "url">>): string | undefined {
  try {
    return decodeURIComponent(new URL(request.url).pathname);
  } catch {
    return undefined;
  }
}

function isAuthenticationFailure(error: unknown): boolean {
  return (
    error instanceof Error &&
    "statusCode" in error &&
    typeof error.statusCode === "number" &&
    error.statusCode >= HTTP_BAD_REQUEST &&
    error.statusCode < HTTP_CLIENT_ERROR_END
  );
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
async function sessionResponse({ context, request }: RequestScope): Promise<Response> {
  return apiResponse(async () => {
    const { user, strong } = await context.session(request, true);
    return {
      strong,
      user: {
        email: user.email,
        id: user.id,
        name: user.name,
        role: user.role,
        twoFactorEnabled: user.twoFactorEnabled,
      },
    };
  }, context.reportError);
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
async function readerStrength({ context, request }: RequestScope): Promise<boolean | undefined> {
  try {
    const reader = await context.session(request, true);
    return reader.strong;
  } catch (error) {
    if (isAuthenticationFailure(error)) {
      return undefined;
    }
    throw error;
  }
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
async function deniedReader(scope: RequestScope, path: string): Promise<Response | undefined> {
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
    headers: {
      "cache-control": "no-store",
      location: strong === undefined ? "/login" : "/security",
    },
    status: HTTP_FOUND,
  });
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
async function mcpResponse(scope: RequestScope): Promise<Response> {
  const { context, request } = scope;
  const authorized = await context.authorizeMcp(request);
  if (authorized instanceof Response) {
    return authorized;
  }
  const search = createWikiSearch(context.embedder(), context.reportError);
  return secureResponse(await handleMcp(request, search));
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
async function protocolResponse(scope: RequestScope, path: string): Promise<Response | undefined> {
  if (path.startsWith("/api/auth/") || path.startsWith("/.well-known/oauth-")) {
    return secureResponse(await scope.context.auth.handler(scope.request));
  }
  if (path === "/mcp") {
    return mcpResponse(scope);
  }
  if (path === "/api/session") {
    return sessionResponse(scope);
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
async function readerResponse(scope: RequestScope, path: string): Promise<Response> {
  const denied = await deniedReader(scope, path);
  if (denied !== undefined) {
    return denied;
  }
  if (path === "/api/search") {
    return searchResponse(scope);
  }
  return secureResponse(await handler.fetch(scope.request));
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
async function handleApplication(scope: RequestScope, path: string): Promise<Response> {
  return (await protocolResponse(scope, path)) ?? (await readerResponse(scope, path));
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
async function handleWithReporting(scope: IncomingScope, path: string): Promise<Response> {
  const context = scope.runtime.forRequest(scope.correlation);
  try {
    return await handleApplication({ ...scope, context }, path);
  } catch (error) {
    context.reportError(error);
    return jsonResponse({ error: "処理に失敗しました。" }, HTTP_INTERNAL_SERVER_ERROR);
  }
}

async function forwardedResponse(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  scope: IncomingScope,
  path: string,
): Promise<Response | undefined> {
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
async function handleRequest(scope: IncomingScope): Promise<Response> {
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
