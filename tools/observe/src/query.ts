export type QueryInput = {
  command: "doctor" | "logs" | "metrics" | "exemplars" | "traces" | "trace";
  service:
    | "user-server"
    | "user-browser"
    | "admin-server"
    | "admin-browser"
    | "wiki-server"
    | "wiki-browser";
  minutes: number;
  limit: number;
  severity?: "INFO" | "ERROR";
  requestId?: string;
  traceId?: string;
  expression?: string;
};

export function queryPath(input: QueryInput, now: number): string {
  if (
    !Number.isInteger(input.minutes) ||
    input.minutes < 1 ||
    input.minutes > 1440 ||
    !Number.isInteger(input.limit) ||
    input.limit < 1 ||
    input.limit > 500
  )
    throw new Error("Invalid query bounds");
  if (input.traceId && !/^[0-9a-f]{32}$/.test(input.traceId)) throw new Error("Invalid trace ID");
  if (input.requestId && !/^[0-9a-f-]{36}$/.test(input.requestId))
    throw new Error("Invalid request ID");
  if (
    ![
      "user-server",
      "user-browser",
      "admin-server",
      "admin-browser",
      "wiki-server",
      "wiki-browser",
    ].includes(input.service)
  )
    throw new Error("Invalid service");
  if (input.severity && !["INFO", "ERROR"].includes(input.severity))
    throw new Error("Invalid severity");
  const start = Math.floor(now / 1000) - input.minutes * 60;
  const end = Math.floor(now / 1000);
  if (input.command === "doctor") return "/api/datasources";
  if (input.command === "logs") {
    const filters = [
      input.severity ? ` | severity_text = "${input.severity}"` : "",
      input.requestId ? ` | request_id = "${input.requestId}"` : "",
      input.traceId ? ` | trace_id = "${input.traceId}"` : "",
    ].join("");
    return `/api/datasources/proxy/uid/loki/loki/api/v1/query_range?${new URLSearchParams({ query: `{service_name="${input.service}"}${filters}`, start: String(start), end: String(end), limit: String(input.limit), direction: "backward" }).toString()}`;
  }
  if (input.command === "metrics") {
    const expression =
      input.expression ??
      `http_${input.service.endsWith("-browser") ? "client" : "server"}_request_duration_seconds_count{service_name="${input.service}"}`;
    if (expression.length > 4096) throw new Error("PromQL expression too long");
    return `/api/datasources/proxy/uid/prometheus/api/v1/query?${new URLSearchParams({ query: expression, time: String(end), timeout: "10s" }).toString()}`;
  }
  if (input.command === "exemplars") {
    const expression =
      input.expression ??
      `http_${input.service.endsWith("-browser") ? "client" : "server"}_request_duration_seconds_bucket{service_name="${input.service}"}`;
    if (expression.length > 4096) throw new Error("PromQL expression too long");
    return `/api/datasources/proxy/uid/prometheus/api/v1/query_exemplars?${new URLSearchParams({ query: expression, start: String(start), end: String(end) }).toString()}`;
  }
  if (input.command === "trace") {
    if (!input.traceId) throw new Error("trace requires --trace-id");
    return `/api/datasources/proxy/uid/tempo/api/traces/${input.traceId}`;
  }
  return `/api/datasources/proxy/uid/tempo/api/search?${new URLSearchParams({ q: `{ resource.service.name = "${input.service}" }`, start: String(start), end: String(end), limit: String(input.limit) }).toString()}`;
}

export async function queryGrafana(base: string, path: string): Promise<unknown> {
  const url = new URL(base);
  if (
    !(
      (url.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) ||
      url.protocol === "https:"
    ) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  )
    throw new Error("Grafana URL must be loopback HTTP or HTTPS without credentials");
  if (!path.startsWith("/api/") || path.startsWith("//"))
    throw new Error("Only read-only Grafana API paths are allowed");
  const response = await fetch(new URL(path, url), {
    method: "GET",
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
    redirect: "error",
  });
  if (!response.ok) throw new Error(`Grafana query failed (${response.status})`);
  const text = await response.text();
  if (text.length > 8_000_000)
    throw new Error("Grafana result exceeds limit; narrow the time range");
  const result: unknown = JSON.parse(text);
  if (result && typeof result === "object" && "status" in result && result.status === "error")
    throw new Error("Datasource query failed");
  return result;
}
