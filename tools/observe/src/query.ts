const commands = ["doctor", "logs", "metrics", "exemplars", "traces", "trace"] as const;
const services = [
  "user-server",
  "user-browser",
  "admin-server",
  "admin-browser",
  "wiki-server",
  "wiki-browser",
] as const;
const severities = ["INFO", "ERROR"] as const;
const minutesPerDay = 1440;
const maxQueryLimit = 500;
const maxExpressionLength = 4096;
const millisecondsPerSecond = 1000;
const secondsPerMinute = 60;
const grafanaTimeoutMilliseconds = 15_000;
const maxResultCharacters = 8_000_000;

interface QueryInput {
  readonly command: (typeof commands)[number];
  readonly service: (typeof services)[number];
  readonly minutes: number;
  readonly limit: number;
  readonly severity?: (typeof severities)[number] | undefined;
  readonly requestId?: string | undefined;
  readonly traceId?: string | undefined;
  readonly expression?: string | undefined;
}

interface TimeRange {
  readonly end: number;
  readonly start: number;
}

function isPresent(value: string | undefined): value is string {
  return value !== undefined && value !== "";
}

function isWithinBound(value: number, maximum: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= maximum;
}

function validateIdentifiers(input: QueryInput): void {
  if (isPresent(input.traceId) && !/^[0-9a-f]{32}$/u.test(input.traceId)) {
    throw new Error("Invalid trace ID");
  }
  if (isPresent(input.requestId) && !/^[0-9a-f-]{36}$/u.test(input.requestId)) {
    throw new Error("Invalid request ID");
  }
}

function validateInput(input: QueryInput): void {
  if (!isWithinBound(input.minutes, minutesPerDay) || !isWithinBound(input.limit, maxQueryLimit)) {
    throw new Error("Invalid query bounds");
  }
  validateIdentifiers(input);
  if (!services.includes(input.service)) {
    throw new Error("Invalid service");
  }
  if (input.severity !== undefined && !severities.includes(input.severity)) {
    throw new Error("Invalid severity");
  }
}

function logsPath(input: QueryInput, { end, start }: TimeRange): string {
  const filters = [
    input.severity === undefined ? "" : ` | severity_text = "${input.severity}"`,
    isPresent(input.requestId) ? ` | request_id = "${input.requestId}"` : "",
    isPresent(input.traceId) ? ` | trace_id = "${input.traceId}"` : "",
  ].join("");
  return `/api/datasources/proxy/uid/loki/loki/api/v1/query_range?${new URLSearchParams({ direction: "backward", end: String(end), limit: String(input.limit), query: `{service_name="${input.service}"}${filters}`, start: String(start) }).toString()}`;
}

function promqlExpression(input: QueryInput, series: "bucket" | "count"): string {
  const expression =
    input.expression ??
    `http_${input.service.endsWith("-browser") ? "client" : "server"}_request_duration_seconds_${series}{service_name="${input.service}"}`;
  if (expression.length > maxExpressionLength) {
    throw new Error("PromQL expression too long");
  }
  return expression;
}

function metricsPath(input: QueryInput, { end }: TimeRange): string {
  return `/api/datasources/proxy/uid/prometheus/api/v1/query?${new URLSearchParams({ query: promqlExpression(input, "count"), time: String(end), timeout: "10s" }).toString()}`;
}

function exemplarsPath(input: QueryInput, { end, start }: TimeRange): string {
  return `/api/datasources/proxy/uid/prometheus/api/v1/query_exemplars?${new URLSearchParams({ end: String(end), query: promqlExpression(input, "bucket"), start: String(start) }).toString()}`;
}

function tracePath(input: QueryInput): string {
  if (!isPresent(input.traceId)) {
    throw new Error("trace requires --trace-id");
  }
  return `/api/datasources/proxy/uid/tempo/api/traces/${input.traceId}`;
}

function tracesPath(input: QueryInput, { end, start }: TimeRange): string {
  const parameters = new URLSearchParams([
    ["end", String(end)],
    ["limit", String(input.limit)],
    ["q", `{ resource.service.name = "${input.service}" }`],
    ["start", String(start)],
  ]);
  return `/api/datasources/proxy/uid/tempo/api/search?${parameters.toString()}`;
}

const pathBuilders: Record<QueryInput["command"], (input: QueryInput, range: TimeRange) => string> =
  {
    doctor: () => "/api/datasources",
    exemplars: exemplarsPath,
    logs: logsPath,
    metrics: metricsPath,
    trace: tracePath,
    traces: tracesPath,
  };

function queryPath(input: QueryInput, now: number): string {
  validateInput(input);
  const end = Math.floor(now / millisecondsPerSecond);
  return pathBuilders[input.command](input, { end, start: end - input.minutes * secondsPerMinute });
}

function grafanaRequestUrl(base: string, path: string): URL {
  const url = new URL(base);
  const loopbackHttp =
    url.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
  if (
    !(loopbackHttp || url.protocol === "https:") ||
    url.username !== "" ||
    url.password !== "" ||
    url.search !== "" ||
    url.hash !== "" ||
    url.pathname !== "/"
  ) {
    throw new Error("Grafana URL must be loopback HTTP or HTTPS without credentials");
  }
  if (!path.startsWith("/api/") || path.startsWith("//")) {
    throw new Error("Only read-only Grafana API paths are allowed");
  }
  return new URL(path, url);
}

function parseGrafanaResult(text: string): unknown {
  if (text.length > maxResultCharacters) {
    throw new Error("Grafana result exceeds limit; narrow the time range");
  }
  const result: unknown = JSON.parse(text);
  if (
    typeof result === "object" &&
    result !== null &&
    "status" in result &&
    result.status === "error"
  ) {
    throw new Error("Datasource query failed");
  }
  return result;
}

async function queryGrafana(base: string, path: string): Promise<unknown> {
  const response = await fetch(grafanaRequestUrl(base, path), {
    headers: { accept: "application/json" },
    method: "GET",
    redirect: "error",
    signal: AbortSignal.timeout(grafanaTimeoutMilliseconds),
  });
  if (!response.ok) {
    throw new Error(`Grafana query failed (${response.status})`);
  }
  return parseGrafanaResult(await response.text());
}

export {
  commands,
  maxQueryLimit,
  millisecondsPerSecond,
  minutesPerDay,
  queryGrafana,
  queryPath,
  services,
  severities,
};
export type { QueryInput };
