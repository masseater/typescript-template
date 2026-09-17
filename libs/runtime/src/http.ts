import { clientErrorSchema } from "@template/observability";
import type { RequestContext, createInstrumentation } from "@template/observability";
import * as v from "valibot";

export { readJson } from "@template/observability";

export function jsonResponse(value: unknown, status = 200): Response {
  return Response.json(value, {
    status,
    headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" },
  });
}

export async function apiResponse(
  action: () => Promise<unknown>,
  reportError?: (error: unknown) => void,
): Promise<Response> {
  try {
    return jsonResponse(await action());
  } catch (error) {
    if (v.isValiError(error)) return jsonResponse({ error: "入力内容を確認してください。" }, 400);
    if (v.is(clientErrorSchema, error))
      return jsonResponse(
        {
          error:
            error.statusCode === 401 ? "ログインしてください。" : "この操作は許可されていません。",
        },
        error.statusCode,
      );
    if (error instanceof Error && error.message.includes("LAST_ADMIN"))
      return jsonResponse({ error: "最後の管理者は削除・降格できません。" }, 409);
    if (error instanceof Error && error.message === "USER_NOT_FOUND_OR_AUTHORITY_REVOKED")
      return jsonResponse({ error: "対象が存在しないか、操作権限が失効しています。" }, 409);
    if (reportError) reportError(error);
    else console.error(JSON.stringify({ event: "application.request_failed" }));
    return jsonResponse(
      { error: "処理に失敗しました。リクエスト ID でログを確認してください。" },
      500,
    );
  }
}

export function secureResponse(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("cache-control", "no-store");
  headers.set("x-content-type-options", "nosniff");
  headers.set("referrer-policy", "no-referrer");
  headers.set("x-frame-options", "DENY");
  headers.set("permissions-policy", "camera=(), microphone=(), geolocation=()");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

type WorkerRuntime = {
  config: { ASSETS: { fetch(request: Request): Promise<Response> } };
  telemetry: ReturnType<typeof createInstrumentation>;
};

export function createWorker<Runtime extends WorkerRuntime>(options: {
  runtime: (bindings: unknown) => Runtime;
  handle: (
    request: Request,
    context: { path: string; runtime: Runtime; correlation: RequestContext },
  ) => Promise<Response> | Response;
}) {
  return {
    async fetch(request: Request, bindings: unknown) {
      const runtime = options.runtime(bindings);
      return runtime.telemetry.wrapRequest(request, async (incoming, correlation) => {
        let path: string;
        try {
          path = decodeURIComponent(new URL(incoming.url).pathname);
        } catch {
          return new Response(null, { status: 400 });
        }
        if (path.endsWith(".map")) return new Response(null, { status: 404 });
        if (path.startsWith("/assets/")) return runtime.config.ASSETS.fetch(incoming);
        if (path === "/api/telemetry") return runtime.telemetry.ingestBrowser(incoming);
        return secureResponse(await options.handle(incoming, { path, runtime, correlation }));
      });
    },
  };
}
