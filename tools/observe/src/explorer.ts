import { array, literal, object, parse, string, unknown } from "valibot";

type Row = Record<string, unknown>;
type LogRow = Row & { readonly event: Row | undefined };

interface RequestTelemetry {
  readonly logs: LogRow[];
  readonly spans: Row[];
}

const explorerTimeoutMilliseconds = 15_000;
const loopbackHosts: ReadonlySet<string> = new Set(["127.0.0.1", "localhost", "[::1]"]);
const columnsSchema = array(string());
const rowSchema = array(unknown());
const queryResponse = object({
  result: object({ columns: columnsSchema, rows: array(rowSchema) }),
  success: literal(true),
});

function explorerOrigin(app: string): URL {
  const url = new URL(app);
  if (
    url.protocol !== "http:" ||
    !loopbackHosts.has(url.hostname) ||
    url.username !== "" ||
    url.password !== "" ||
    url.search !== "" ||
    url.hash !== "" ||
    url.pathname !== "/"
  ) {
    throw new Error("Local Explorer is only reachable through a loopback HTTP app origin");
  }
  return url;
}

async function queryExplorer(
  app: string,
  sql: string,
  params: readonly (string | number)[] = [],
): Promise<Row[]> {
  const origin = explorerOrigin(app);
  const result = await fetch(
    new URL("/cdn-cgi/local/explorer/api/local/observability/query", origin),
    {
      body: JSON.stringify({ params, sql }),
      headers: { accept: "application/json", "content-type": "application/json" },
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(explorerTimeoutMilliseconds),
    },
  );
  if (!result.ok) {
    throw new Error(`Local Explorer query failed (${result.status})`);
  }
  const { columns, rows } = parse(queryResponse, await result.json()).result;
  return rows.map((row: readonly unknown[]) =>
    Object.fromEntries(columns.map((column, index) => [column, row[index]])),
  );
}

function structuredMessage(message: unknown): Row | undefined {
  if (typeof message !== "string") {
    return undefined;
  }
  try {
    const args: unknown = JSON.parse(message);
    const first: unknown = Array.isArray(args) ? args[0] : args;
    const parsed: unknown = typeof first === "string" ? JSON.parse(first) : undefined;
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? Object.fromEntries(Object.entries(parsed))
      : undefined;
  } catch {
    return undefined;
  }
}

function withEvent({ message, ...row }: Readonly<Row>): LogRow {
  return { ...row, event: structuredMessage(message) };
}

async function requestTelemetry(app: string, requestId: string): Promise<RequestTelemetry> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(requestId)) {
    throw new Error("Invalid request ID");
  }
  const pattern = String.raw`request_id\":\"${requestId}`;
  const [logs, spans] = await Promise.all([
    queryExplorer(
      app,
      "SELECT trace_id, span_id, ts_ms, level, message FROM logs WHERE instr(message, ?) > 0 ORDER BY ts_ms LIMIT 500",
      [pattern],
    ),
    queryExplorer(
      app,
      "SELECT trace_id, span_id, parent_id, service, name, kind, start_ms, duration_ms, outcome, error, json(attributes) AS attributes FROM spans WHERE trace_id IN (SELECT trace_id FROM logs WHERE instr(message, ?) > 0) ORDER BY start_ms LIMIT 2000",
      [pattern],
    ),
  ]);
  return { logs: logs.map((row: Readonly<Row>) => withEvent(row)), spans };
}

export { explorerOrigin, queryExplorer, requestTelemetry, withEvent };
