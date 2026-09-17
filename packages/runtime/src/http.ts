import * as v from "valibot";

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
    if (
      error instanceof Error &&
      "statusCode" in error &&
      typeof error.statusCode === "number" &&
      error.statusCode >= 400 &&
      error.statusCode < 500
    )
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

export async function readJson(request: Request, expectedOrigin: string): Promise<unknown> {
  if (
    request.headers.get("origin") !== expectedOrigin ||
    request.headers.get("sec-fetch-site") === "cross-site"
  )
    throw Object.assign(new Error("ORIGIN_DENIED"), { statusCode: 403 });
  if (request.headers.get("content-type")?.split(";")[0] !== "application/json")
    throw Object.assign(new Error("JSON_REQUIRED"), { statusCode: 415 });
  const reader = request.body?.getReader();
  if (!reader) throw Object.assign(new Error("BODY_REQUIRED"), { statusCode: 400 });
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    length += chunk.value.byteLength;
    if (length > 16384) {
      await reader.cancel();
      throw Object.assign(new Error("BODY_TOO_LARGE"), { statusCode: 413 });
    }
    chunks.push(chunk.value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  } catch {
    throw Object.assign(new Error("INVALID_JSON"), { statusCode: 400 });
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
