import { Result, Schema } from "effect";
import { ErrorBody } from "./contracts.ts";

export async function requestJson<S extends Schema.Top & { readonly DecodingServices: never }>(
  path: string,
  response: S,
  options?: { method: "PATCH" | "DELETE"; body: unknown },
): Promise<S["Type"]> {
  if (!path.startsWith("/api/") || path.startsWith("//"))
    throw new Error("同じアプリの API を指定してください。");
  const reply = await fetch(path, {
    method: options?.method ?? "GET",
    credentials: "same-origin",
    cache: "no-store",
    redirect: "error",
    ...(options
      ? { headers: { "content-type": "application/json" }, body: JSON.stringify(options.body) }
      : {}),
  });
  const body: unknown = await reply.json();
  if (!reply.ok) {
    const failure = Schema.decodeUnknownResult(ErrorBody)(body);
    const message = Result.isSuccess(failure)
      ? failure.success.error
      : `リクエストに失敗しました（HTTP ${reply.status}）。`;
    const requestId = reply.headers.get("x-request-id");
    throw new Error(`${message}${requestId ? ` リクエスト ID: ${requestId}` : ""}`);
  }
  const decoded = Schema.decodeUnknownResult(response)(body);
  if (Result.isFailure(decoded)) throw new Error("サーバーの応答形式が不正です。");
  return decoded.success;
}
