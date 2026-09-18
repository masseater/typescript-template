import { setupNetwork } from "@msw/cloudflare";
import { APPLICATION } from "@repo/config";
import { Effect, Ref } from "effect";
import { HttpResponse, http } from "msw";

import { RequestEntropy } from "./request-span.ts";
import { Telemetry, flushTelemetry, observeRequest } from "./server.ts";
import { isRecord } from "./structured-logs.ts";
import { fixedSpans } from "./testing.ts";

import type { OtlpDestination } from "./otlp.ts";

const endpoint = "https://otlp.example.test";
const authorization = "Bearer otlp-test-token";

const started = Ref.makeUnsafe<ReturnType<typeof setupNetwork> | undefined>(undefined);

const network = (): ReturnType<typeof setupNetwork> => {
  const listening = Ref.getUnsafe(started);
  if (listening !== undefined) {
    return listening;
  }
  const opened = setupNetwork();
  opened.configure({ onUnhandledFrame: "error" });
  opened.enable();
  Effect.runSync(Ref.set(started, opened));
  return opened;
};

const patterns = {
  attributeKey: /"key":"(?<found>[^"]+)"/gu,
  body: /"body":\{"stringValue":"(?<found>[^"]+)"\}/gu,
  severityText: /"severityText":"(?<found>[^"]+)"/gu,
  traceId: /"traceId":"(?<found>[0-9a-f]{32})"/gu,
} as const;

const distinct = (found: readonly string[]): readonly string[] => [...new Set(found)].toSorted();

const captured = (exportedText: string, named: keyof typeof patterns): readonly string[] =>
  distinct(
    Array.from(
      exportedText.matchAll(new RegExp(patterns[named], "gu")),
      (match) => match.groups?.found ?? "",
    ),
  );

const traceparentPattern = /^00-(?<traceId>[0-9a-f]{32})-[0-9a-f]{16}-01$/u;

const fixedEntropy = Effect.provideService(RequestEntropy, {
  epochMilliseconds: () => 1_800_000_000_000,
  monotonicMilliseconds: () => 0,
  requestId: () => "22222222-2222-4222-8222-222222222222",
});

const noContent = 204;

type SeenExports = {
  readonly authorizations: readonly string[];
  readonly logs: readonly unknown[];
  readonly traces: readonly unknown[];
  readonly structuredLines: readonly Readonly<Record<string, unknown>>[];
};

type OtlpExportSummary = {
  readonly authorizations: readonly string[];
  readonly exportsCarryRedaction: boolean;
  readonly exportsCarrySecret: boolean;
  readonly logAttributeKeys: readonly string[];
  readonly logBodies: readonly string[];
  readonly logTraceIds: readonly string[];
  readonly requestTraceId: string;
  readonly severityTexts: readonly string[];
  readonly signalCounts: readonly number[];
  readonly structuredLines: readonly Readonly<Record<string, unknown>>[];
  readonly traceTraceIds: readonly string[];
};

const requestMark = "<request>";

const marked = (found: readonly string[], requestTraceId: string): readonly string[] =>
  found.map((traceId) => (traceId === requestTraceId ? requestMark : traceId));

const spanMark = "<span>";
const spanIdPattern = /^[0-9a-f]{16}$/u;

const markedLine = (
  line: Readonly<Record<string, unknown>>,
  requestTraceId: string,
): Readonly<Record<string, unknown>> =>
  Object.fromEntries(
    Object.entries(line).map(([fieldName, fieldValue]) => {
      if (fieldName === "trace_id" && fieldValue === requestTraceId) {
        return [fieldName, requestMark];
      }
      if (
        fieldName === "span_id" &&
        typeof fieldValue === "string" &&
        spanIdPattern.test(fieldValue)
      ) {
        return [fieldName, spanMark];
      }
      return [fieldName, fieldValue];
    }),
  );

const summarized = (summary: {
  readonly seen: SeenExports;
  readonly traceparent: string;
  readonly secret: string;
}): OtlpExportSummary => {
  const { seen } = summary;
  const exportedLogs = JSON.stringify(seen.logs);
  const exportedSignals = `${exportedLogs}${JSON.stringify(seen.traces)}`;
  const requestTraceId = traceparentPattern.exec(summary.traceparent)?.groups?.traceId ?? "";
  return {
    authorizations: distinct(seen.authorizations),
    exportsCarryRedaction: exportedSignals.includes("[redacted]"),
    exportsCarrySecret: summary.secret !== "" && exportedSignals.includes(summary.secret),
    logAttributeKeys: captured(exportedLogs, "attributeKey"),
    logBodies: captured(exportedLogs, "body"),
    logTraceIds: marked(captured(exportedLogs, "traceId"), requestTraceId),
    requestTraceId: requestTraceId === "" ? "" : requestMark,
    severityTexts: captured(exportedLogs, "severityText"),
    signalCounts: [seen.logs.length, seen.traces.length],
    structuredLines: seen.structuredLines.map((line) => markedLine(line, requestTraceId)),
    traceTraceIds: marked(captured(JSON.stringify(seen.traces), "traceId"), requestTraceId),
  };
};

const otlpExportSummary = async (exported: {
  readonly otlp?: OtlpDestination;
  readonly respond?: () => Response;
  readonly alongside?: Effect.Effect<void>;
  readonly secret?: string;
}): Promise<OtlpExportSummary> => {
  const seen = Ref.makeUnsafe<SeenExports>({
    authorizations: [],
    logs: [],
    structuredLines: [],
    traces: [],
  });
  const recordLine = (written: string): void => {
    const decoded: unknown = JSON.parse(written);
    Effect.runSync(
      Ref.update(seen, (earlier) =>
        isRecord(decoded)
          ? { ...earlier, structuredLines: [...earlier.structuredLines, decoded] }
          : earlier,
      ),
    );
  };
  const collect =
    (signal: "logs" | "traces"): Parameters<typeof http.post>[1] =>
    async ({ request }) => {
      const sent: unknown = await request.json();
      const header = request.headers.get("authorization") ?? "";
      Effect.runSync(
        Ref.update(seen, (earlier) => ({
          ...earlier,
          authorizations: [...earlier.authorizations, header],
          [signal]: [...earlier[signal], sent],
        })),
      );
      return exported.respond === undefined ? HttpResponse.json({}) : exported.respond();
    };
  network().use(
    http.post(`${endpoint}/v1/traces`, collect("traces")),
    http.post(`${endpoint}/v1/logs`, collect("logs")),
  );
  const traceparent = await Effect.runPromise(
    Effect.gen(function* observedProgram() {
      const answered = yield* observeRequest(new Request("http://localhost/"), () =>
        Effect.succeed(new Response(undefined, { status: noContent })),
      );
      yield* exported.alongside ?? Effect.void;
      yield* flushTelemetry;
      return answered.headers.get("traceparent") ?? "";
    }).pipe(
      Effect.provide(
        Telemetry.layer({
          log: { error: recordLine, info: recordLine, warn: recordLine },
          otlp: exported.otlp,
          release: "abc123",
          routes: { "/": "home" },
          serviceName: APPLICATION.user,
        }),
      ),
      fixedEntropy,
      Effect.withTracer(fixedSpans),
      Effect.orDie,
    ),
  );
  network().resetHandlers();
  return summarized({
    seen: Ref.getUnsafe(seen),
    secret: exported.secret ?? "",
    traceparent,
  });
};

export { authorization, endpoint, otlpExportSummary };
export type { OtlpExportSummary };
