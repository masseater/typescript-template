import { millisecondsPerSecond, queryGrafana, queryPath } from "./query.ts";
import { parse, picklist, pipe, string, url } from "valibot";
import type { QueryInput } from "./query.ts";
import { delay } from "es-toolkit";
// oxlint-disable-next-line import/no-nodejs-modules
import { parseArgs } from "node:util";

interface CorrelationInput extends Omit<QueryInput, "command"> {
  readonly requestId: string;
  readonly traceId: string;
}

const appTimeoutMilliseconds = 15_000;
const correlationWindowMilliseconds = 45_000;
const firstServerErrorStatus = 500;
const appUrlSchema = pipe(string(), url());

const { values } = parseArgs({
  options: {
    app: { type: "string" },
    grafana: { default: "http://127.0.0.1:3100", type: "string" },
    service: { default: "user-server", type: "string" },
  },
});

function appUrl(value: string | undefined): URL {
  const app = new URL(parse(appUrlSchema, value));
  if (
    !(
      (app.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(app.hostname)) ||
      app.protocol === "https:"
    ) ||
    app.username !== "" ||
    app.password !== "" ||
    app.search !== "" ||
    app.hash !== ""
  ) {
    throw new Error("App URL requires loopback HTTP or HTTPS and no secrets");
  }
  return app;
}

function signalPath(input: CorrelationInput, command: QueryInput["command"]): string {
  return queryPath({ ...input, command }, Date.now());
}

async function correlated(input: CorrelationInput): Promise<boolean> {
  const [logs, traces, exemplars] = await Promise.all([
    queryGrafana(values.grafana, signalPath(input, "logs")),
    queryGrafana(values.grafana, signalPath(input, "traces")),
    queryGrafana(values.grafana, signalPath(input, "exemplars")),
  ]);
  return (
    JSON.stringify(logs).includes(input.requestId) &&
    JSON.stringify(traces).includes(input.traceId) &&
    JSON.stringify(exemplars).includes(input.traceId)
  );
}

async function waitForCorrelation(input: CorrelationInput, deadline: number): Promise<boolean> {
  if (Date.now() >= deadline) {
    return false;
  }
  if (await correlated(input)) {
    return true;
  }
  await delay(millisecondsPerSecond);
  return waitForCorrelation(input, deadline);
}

try {
  const service = parse(picklist(["user-server", "admin-server"]), values.service);
  const response = await fetch(appUrl(values.app), {
    method: "GET",
    redirect: "manual",
    signal: AbortSignal.timeout(appTimeoutMilliseconds),
  });
  await response.body?.cancel();
  const requestId = response.headers.get("x-request-id") ?? "";
  const traceId = response.headers.get("traceparent")?.split("-")[1] ?? "";
  if (requestId === "" || traceId === "" || response.status >= firstServerErrorStatus) {
    throw new Error("App must return a non-error response with correlation headers");
  }
  const input = { limit: 100, minutes: 5, requestId, service, traceId };
  if (!(await waitForCorrelation(input, Date.now() + correlationWindowMilliseconds))) {
    throw new Error("LGTM did not expose correlated data within 45 seconds");
  }
  process.stdout.write(
    `${JSON.stringify({
      ok: true,
      requestId,
      responseStatus: response.status,
      service,
      signals: ["logs", "metrics", "traces"],
      traceId,
    })}\n`,
  );
} catch {
  process.stderr.write(
    `${JSON.stringify({
      event: "observability.verification_failed",
      ok: false,
      remediation:
        "Specify --app with a running app URL. Check LGTM, collector exports and Prometheus exemplar storage; all three signals must contain the real request correlation.",
    })}\n`,
  );
  process.exitCode = 1;
}
