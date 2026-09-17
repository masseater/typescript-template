import { parseArgs } from "node:util";
import { setTimeout } from "node:timers/promises";
import * as v from "valibot";
import { queryGrafana, queryPath } from "./query.ts";

const { values } = parseArgs({
  options: {
    grafana: { type: "string", default: "http://127.0.0.1:3100" },
    app: { type: "string" },
    service: { type: "string", default: "user-server" },
  },
});

try {
  const service = v.parse(v.picklist(["user-server", "admin-server"]), values.service);
  const app = new URL(v.parse(v.pipe(v.string(), v.url()), values.app));
  if (
    !(
      (app.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(app.hostname)) ||
      app.protocol === "https:"
    ) ||
    app.username ||
    app.password ||
    app.search ||
    app.hash
  )
    throw new Error("App URL requires loopback HTTP or HTTPS and no secrets");
  const response = await fetch(app, {
    method: "GET",
    redirect: "manual",
    signal: AbortSignal.timeout(15_000),
  });
  await response.body?.cancel();
  const requestId = response.headers.get("x-request-id");
  const traceId = response.headers.get("traceparent")?.split("-")[1];
  if (!requestId || !traceId || response.status >= 500)
    throw new Error("App must return a non-error response with correlation headers");
  const input = { service, minutes: 5, limit: 100, requestId, traceId };
  const deadline = Date.now() + 45_000;
  let found = false;
  while (Date.now() < deadline) {
    const logs = await queryGrafana(
      values.grafana,
      queryPath({ ...input, command: "logs" }, Date.now()),
    );
    const traces = await queryGrafana(
      values.grafana,
      queryPath({ ...input, command: "traces" }, Date.now()),
    );
    const exemplars = await queryGrafana(
      values.grafana,
      queryPath(
        {
          ...input,
          command: "exemplars",
        },
        Date.now(),
      ),
    );
    if (
      JSON.stringify(logs).includes(requestId) &&
      JSON.stringify(traces).includes(traceId) &&
      JSON.stringify(exemplars).includes(traceId)
    ) {
      console.info(
        JSON.stringify({
          ok: true,
          requestId,
          traceId,
          responseStatus: response.status,
          service,
          signals: ["logs", "metrics", "traces"],
        }),
      );
      found = true;
      break;
    }
    await setTimeout(1000);
  }
  if (!found) throw new Error("LGTM did not expose correlated data within 45 seconds");
} catch {
  console.error(
    JSON.stringify({
      ok: false,
      event: "observability.verification_failed",
      remediation:
        "Specify --app with a running app URL. Check LGTM, collector exports and Prometheus exemplar storage; all three signals must contain the real request correlation.",
    }),
  );
  process.exitCode = 1;
}
