interface Mutation {
  readonly method: "PATCH" | "DELETE";
  readonly body: unknown;
}

function errorMessage(body: unknown, status: number): string {
  if (
    typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof body.error === "string"
  ) {
    return body.error;
  }
  return `リクエストに失敗しました（HTTP ${status}）。`;
}

async function requestJson(path: string, options?: Mutation): Promise<unknown> {
  if (!path.startsWith("/api/") || path.startsWith("//")) {
    throw new Error("同じアプリの API を指定してください。");
  }
  const response = await fetch(path, {
    cache: "no-store",
    credentials: "same-origin",
    method: options?.method ?? "GET",
    redirect: "error",
    ...(options
      ? { body: JSON.stringify(options.body), headers: { "content-type": "application/json" } }
      : {}),
  });
  const body: unknown = await response.json();
  if (!response.ok) {
    const requestId = response.headers.get("x-request-id");
    const reference = requestId === null || requestId === "" ? "" : ` リクエスト ID: ${requestId}`;
    throw new Error(`${errorMessage(body, response.status)}${reference}`);
  }
  return body;
}

export { requestJson };
