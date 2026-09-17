export async function requestJson(
  path: string,
  options?: { method: "PATCH" | "DELETE"; body: unknown },
): Promise<unknown> {
  if (!path.startsWith("/api/") || path.startsWith("//"))
    throw new Error("同じアプリの API を指定してください。");
  const response = await fetch(path, {
    method: options?.method ?? "GET",
    credentials: "same-origin",
    cache: "no-store",
    redirect: "error",
    ...(options
      ? { headers: { "content-type": "application/json" }, body: JSON.stringify(options.body) }
      : {}),
  });
  const body: unknown = await response.json();
  if (!response.ok) {
    const message =
      typeof body === "object" && body !== null && "error" in body && typeof body.error === "string"
        ? body.error
        : `リクエストに失敗しました（HTTP ${response.status}）。`;
    const requestId = response.headers.get("x-request-id");
    throw new Error(`${message}${requestId ? ` リクエスト ID: ${requestId}` : ""}`);
  }
  return body;
}
