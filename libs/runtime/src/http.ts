import type { Instrumentation, RequestContext } from "@template/observability";
import { is, isValiError } from "valibot";
import { clientErrorSchema } from "@template/observability";

interface WorkerRuntime {
  readonly config: Readonly<{
    ASSETS: Readonly<{
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
      fetch: (request: Request) => Promise<Response>;
    }>;
  }>;
  readonly telemetry: Instrumentation;
}

interface WorkerRoute<Runtime> {
  readonly correlation: RequestContext;
  readonly path: string;
  readonly runtime: Runtime;
}

interface WorkerOptions<Runtime> {
  readonly runtime: (bindings: unknown) => Runtime;
  readonly handle: (
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
    request: Request,
    route: WorkerRoute<Runtime>,
  ) => Promise<Response> | Response;
}

interface WorkerEntry {
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  readonly fetch: (request: Request, bindings: unknown) => Promise<Response>;
}

const ok = 200;
const badRequest = 400;
const unauthorized = 401;
const notFound = 404;
const conflict = 409;
const internalServerError = 500;

function jsonResponse(value: unknown, status = ok): Response {
  return Response.json(value, {
    headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" },
    status,
  });
}

function conflictMessage(error: unknown): string | undefined {
  if (!(error instanceof Error)) {
    return undefined;
  }
  if (error.message.includes("LAST_ADMIN")) {
    return "最後の管理者は削除・降格できません。";
  }
  if (error.message === "USER_NOT_FOUND_OR_AUTHORITY_REVOKED") {
    return "対象が存在しないか、操作権限が失効しています。";
  }
  return undefined;
}

function knownErrorResponse(error: unknown): Response | undefined {
  if (isValiError(error)) {
    return jsonResponse({ error: "入力内容を確認してください。" }, badRequest);
  }
  if (is(clientErrorSchema, error)) {
    const message =
      error.statusCode === unauthorized
        ? "ログインしてください。"
        : "この操作は許可されていません。";
    return jsonResponse({ error: message }, error.statusCode);
  }
  const conflictText = conflictMessage(error);
  return conflictText === undefined ? undefined : jsonResponse({ error: conflictText }, conflict);
}

async function apiResponse(
  action: () => Promise<unknown>,
  reportError?: (error: unknown) => void,
): Promise<Response> {
  try {
    return jsonResponse(await action());
  } catch (error) {
    const known = knownErrorResponse(error);
    if (known) {
      return known;
    }
    if (reportError) {
      reportError(error);
    } else {
      // oxlint-disable-next-line no-console
      console.error(JSON.stringify({ event: "application.request_failed" }));
    }
    return jsonResponse(
      { error: "処理に失敗しました。リクエスト ID でログを確認してください。" },
      internalServerError,
    );
  }
}

function secureResponse(
  response: Readonly<{
    body: Readonly<ReadableStream<Uint8Array>> | null;
    headers: Readonly<Headers>;
    status: number;
    statusText: string;
  }>,
): Response {
  const headers = new Headers(response.headers);
  headers.set("cache-control", "no-store");
  headers.set("x-content-type-options", "nosniff");
  headers.set("referrer-policy", "no-referrer");
  headers.set("x-frame-options", "DENY");
  headers.set("permissions-policy", "camera=(), microphone=(), geolocation=()");
  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}

function requestPath(url: string): string | undefined {
  try {
    return decodeURIComponent(new URL(url).pathname);
  } catch {
    return undefined;
  }
}

function infrastructureResponse(
  runtime: WorkerRuntime,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  request: Request,
  path: string,
): Promise<Response> | Response | undefined {
  if (path.endsWith(".map")) {
    return new Response(undefined, { status: notFound });
  }
  if (path.startsWith("/assets/")) {
    return runtime.config.ASSETS.fetch(request);
  }
  if (path === "/api/telemetry") {
    return runtime.telemetry.ingestBrowser(request);
  }
  return undefined;
}

async function routeRequest<Runtime extends WorkerRuntime>(
  options: WorkerOptions<Runtime>,
  runtime: Runtime,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
  { correlation, incoming }: Readonly<{ correlation: RequestContext; incoming: Request }>,
): Promise<Response> {
  const path = requestPath(incoming.url);
  if (path === undefined) {
    return new Response(undefined, { status: badRequest });
  }
  const infrastructure = infrastructureResponse(runtime, incoming, path);
  if (infrastructure !== undefined) {
    return infrastructure;
  }
  return secureResponse(await options.handle(incoming, { correlation, path, runtime }));
}

function createWorker<Runtime extends WorkerRuntime>(options: WorkerOptions<Runtime>): WorkerEntry {
  return {
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
    fetch: async (request, bindings) => {
      const runtime = options.runtime(bindings);
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
      return runtime.telemetry.wrapRequest(request, async (incoming, correlation) =>
        routeRequest(options, runtime, { correlation, incoming }),
      );
    },
  };
}

export { apiResponse, createWorker, jsonResponse, secureResponse };
export { readJson } from "@template/observability";
