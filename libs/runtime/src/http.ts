import { isValiError } from "valibot";

const ok = 200;
const badRequest = 400;
const unauthorized = 401;
const forbidden = 403;
const payloadTooLarge = 413;
const unsupportedMediaType = 415;
const conflict = 409;
const clientErrorEnd = 500;
const internalServerError = 500;
const maximumBodyBytes = 16_384;

function jsonResponse(value: unknown, status = ok): Response {
  return Response.json(value, {
    headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" },
    status,
  });
}

function statusError(message: string, statusCode: number): Error {
  return Object.assign(new Error(message), { statusCode });
}

function clientErrorStatus(error: unknown): number | undefined {
  if (
    error instanceof Error &&
    "statusCode" in error &&
    typeof error.statusCode === "number" &&
    error.statusCode >= badRequest &&
    error.statusCode < clientErrorEnd
  ) {
    return error.statusCode;
  }
  return undefined;
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
  const status = clientErrorStatus(error);
  if (status !== undefined) {
    const message =
      status === unauthorized ? "ログインしてください。" : "この操作は許可されていません。";
    return jsonResponse({ error: message }, status);
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
      console.error(JSON.stringify({ event: "application.request_failed" }));
    }
    return jsonResponse(
      { error: "処理に失敗しました。リクエスト ID でログを確認してください。" },
      internalServerError,
    );
  }
}

function assertJsonMutation(request: Request, expectedOrigin: string): void {
  if (
    request.headers.get("origin") !== expectedOrigin ||
    request.headers.get("sec-fetch-site") === "cross-site"
  ) {
    throw statusError("ORIGIN_DENIED", forbidden);
  }
  if (request.headers.get("content-type")?.split(";")[0] !== "application/json") {
    throw statusError("JSON_REQUIRED", unsupportedMediaType);
  }
}

async function readBoundedText(body: ReadableStream<Uint8Array>): Promise<string> {
  const decoder = new TextDecoder();
  let length = 0;
  let text = "";
  for await (const chunk of body) {
    length += chunk.byteLength;
    if (length > maximumBodyBytes) {
      throw statusError("BODY_TOO_LARGE", payloadTooLarge);
    }
    text += decoder.decode(chunk, { stream: true });
  }
  return text + decoder.decode();
}

async function readJson(request: Request, expectedOrigin: string): Promise<unknown> {
  assertJsonMutation(request, expectedOrigin);
  if (!request.body) {
    throw statusError("BODY_REQUIRED", badRequest);
  }
  const text = await readBoundedText(request.body);
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw statusError("INVALID_JSON", badRequest);
  }
}

function secureResponse(response: Response): Response {
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

export { apiResponse, jsonResponse, readJson, secureResponse };
