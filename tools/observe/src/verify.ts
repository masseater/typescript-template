import { parseArgs } from "node:util";
import { setTimeout } from "node:timers/promises";
import * as v from "valibot";
import { explorerOrigin, requestTelemetry } from "./explorer.ts";

const { values } = parseArgs({
  options: {
    app: { type: "string" },
    service: { type: "string", default: "user-server" },
  },
});

try {
  const service = v.parse(
    v.picklist(["user-server", "admin-server", "wiki-server"]),
    values.service,
  );
  const app = explorerOrigin(v.parse(v.string(), values.app));
  const response = await fetch(app, {
    method: "GET",
    redirect: "manual",
    signal: AbortSignal.timeout(15_000),
  });
  await response.body?.cancel();
  const requestId = response.headers.get("x-request-id");
  if (!requestId || response.status >= 500)
    throw new Error("App must return a non-error response with correlation headers");
  const deadline = Date.now() + 45_000;
  let verified: { spans: number; logs: number } | undefined;
  while (Date.now() < deadline && !verified) {
    const telemetry = await requestTelemetry(app.href, requestId);
    const logged = telemetry.logs.some(
      ({ event }) =>
        event?.["event"] === "http.server.request" &&
        event["service"] === service &&
        event["request_id"] === requestId,
    );
    const traced = telemetry.spans.some(
      (span) => span["parent_id"] === null && span["duration_ms"] !== null,
    );
    if (logged && traced) verified = { spans: telemetry.spans.length, logs: telemetry.logs.length };
    else await setTimeout(1000);
  }
  if (!verified) throw new Error("Local Explorer did not expose correlated data within 45 seconds");
  console.info(
    JSON.stringify({
      ok: true,
      requestId,
      responseStatus: response.status,
      service,
      signals: ["logs", "traces"],
      ...verified,
    }),
  );
} catch {
  console.error(
    JSON.stringify({
      ok: false,
      event: "observability.verification_failed",
      remediation:
        "Specify --app with a running local app origin such as http://127.0.0.1:3001/. The request must appear in Local Explorer as a structured log and a completed trace.",
    }),
  );
  process.exitCode = 1;
}
