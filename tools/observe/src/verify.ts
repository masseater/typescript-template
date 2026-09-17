import { explorerOrigin, requestTelemetry } from "./explorer.ts";
import { parse, picklist, string } from "valibot";
import { delay } from "es-toolkit";
// oxlint-disable-next-line import/no-nodejs-modules
import { parseArgs } from "node:util";

interface Verified {
  readonly logs: number;
  readonly spans: number;
}

interface VerificationTarget {
  readonly app: string;
  readonly requestId: string;
  readonly service: string;
}

type Fields = Readonly<Record<string, unknown>>;

const appTimeoutMilliseconds = 15_000;
const correlationWindowMilliseconds = 45_000;
const pollIntervalMilliseconds = 1000;
const firstServerErrorStatus = 500;

const { values } = parseArgs({
  options: {
    app: { type: "string" },
    service: { default: "user-server", type: "string" },
  },
});

async function correlated(target: VerificationTarget): Promise<Verified | undefined> {
  const telemetry = await requestTelemetry(target.app, target.requestId);
  const logged = telemetry.logs.some(
    ({ event }: Readonly<{ event: Fields | undefined }>) =>
      event?.["event"] === "http.server.request" &&
      event["service"] === target.service &&
      event["request_id"] === target.requestId,
  );
  const traced = telemetry.spans.some(
    (span: Fields) => span["parent_id"] === null && span["duration_ms"] !== null,
  );
  return logged && traced
    ? { logs: telemetry.logs.length, spans: telemetry.spans.length }
    : undefined;
}

async function waitForCorrelation(
  target: VerificationTarget,
  deadline: number,
): Promise<Verified | undefined> {
  if (Date.now() >= deadline) {
    return undefined;
  }
  const verified = await correlated(target);
  if (verified !== undefined) {
    return verified;
  }
  await delay(pollIntervalMilliseconds);
  return waitForCorrelation(target, deadline);
}

try {
  const service = parse(picklist(["user-server", "admin-server", "wiki-server"]), values.service);
  const app = explorerOrigin(parse(string(), values.app));
  const response = await fetch(app, {
    method: "GET",
    redirect: "manual",
    signal: AbortSignal.timeout(appTimeoutMilliseconds),
  });
  await response.body?.cancel();
  const requestId = response.headers.get("x-request-id") ?? "";
  if (requestId === "" || response.status >= firstServerErrorStatus) {
    throw new Error("App must return a non-error response with correlation headers");
  }
  const verified = await waitForCorrelation(
    { app: app.href, requestId, service },
    Date.now() + correlationWindowMilliseconds,
  );
  if (verified === undefined) {
    throw new Error("Local Explorer did not expose correlated data within 45 seconds");
  }
  process.stdout.write(
    `${JSON.stringify({
      ok: true,
      requestId,
      responseStatus: response.status,
      service,
      signals: ["logs", "traces"],
      ...verified,
    })}\n`,
  );
} catch {
  process.stderr.write(
    `${JSON.stringify({
      event: "observability.verification_failed",
      ok: false,
      remediation:
        "Specify --app with a running local app origin such as http://127.0.0.1:3001/. The request must appear in Local Explorer as a structured log and a completed trace.",
    })}\n`,
  );
  process.exitCode = 1;
}
