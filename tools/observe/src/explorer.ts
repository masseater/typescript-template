import * as v from "valibot";

const response = v.object({
  success: v.literal(true),
  result: v.object({
    columns: v.array(v.string()),
    rows: v.array(v.array(v.unknown())),
  }),
});

export function explorerOrigin(app: string): URL {
  const url = new URL(app);
  if (
    url.protocol !== "http:" ||
    !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  )
    throw new Error("Local Explorer is only reachable through a loopback HTTP app origin");
  return url;
}

export async function queryExplorer(
  app: string,
  sql: string,
  params: readonly (string | number)[] = [],
): Promise<Record<string, unknown>[]> {
  const origin = explorerOrigin(app);
  const result = await fetch(
    new URL("/cdn-cgi/local/explorer/api/local/observability/query", origin),
    {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify({ sql, params }),
      signal: AbortSignal.timeout(15_000),
      redirect: "error",
    },
  );
  if (!result.ok) throw new Error(`Local Explorer query failed (${result.status})`);
  const { columns, rows } = v.parse(response, await result.json()).result;
  return rows.map((row) =>
    Object.fromEntries(columns.map((column, index) => [column, row[index]])),
  );
}

export function structuredMessage(message: unknown): Record<string, unknown> | undefined {
  if (typeof message !== "string") return undefined;
  try {
    const args: unknown = JSON.parse(message);
    const first: unknown = Array.isArray(args) ? args[0] : args;
    const parsed: unknown = typeof first === "string" ? JSON.parse(first) : undefined;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? Object.fromEntries(Object.entries(parsed))
      : undefined;
  } catch {
    return undefined;
  }
}

export async function requestTelemetry(app: string, requestId: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(requestId))
    throw new Error("Invalid request ID");
  const pattern = `request_id\\":\\"${requestId}`;
  const logs = await queryExplorer(
    app,
    "SELECT trace_id, span_id, ts_ms, level, message FROM logs WHERE instr(message, ?) > 0 ORDER BY ts_ms LIMIT 500",
    [pattern],
  );
  const spans = await queryExplorer(
    app,
    "SELECT trace_id, span_id, parent_id, service, name, kind, start_ms, duration_ms, outcome, error, json(attributes) AS attributes FROM spans WHERE trace_id IN (SELECT trace_id FROM logs WHERE instr(message, ?) > 0) ORDER BY start_ms LIMIT 2000",
    [pattern],
  );
  return {
    logs: logs.map(({ message, ...row }) => ({ ...row, event: structuredMessage(message) })),
    spans,
  };
}
