import { httpStatus } from "@repo/config";
import { Duration, Effect, Layer, Logger } from "effect";
import {
  FetchHttpClient,
  HttpClient,
  type HttpClientError,
  type HttpClientResponse,
} from "effect/unstable/http";
import {
  OtlpExporter,
  OtlpLogger,
  OtlpSerialization,
  OtlpTracer,
} from "effect/unstable/observability";

import { logAt } from "./severity.ts";
import { redactedLogger } from "./structured-logs.ts";

type OtlpDestination = {
  readonly endpoint: string;
  readonly authorization?: string | undefined;
};

type TelemetryFlusher = OtlpExporter.Flusher;

const trailingSlashes = /\/+$/u;
const flushTelemetry = Effect.flatMap(OtlpExporter.Flusher, (flusher) => flusher.flush);

const otlpSignalUrl = (endpoint: string, signal: "logs" | "traces"): string =>
  `${endpoint.replace(trailingSlashes, "")}/v1/${signal}`;

const reportRejection = (
  answered: Readonly<Pick<HttpClientResponse.HttpClientResponse, "status">>,
): Effect.Effect<void> =>
  answered.status >= httpStatus.badRequest
    ? logAt("Warn", {
        eventName: "otlp.export_failed",
        attributes: { "otlp.status": answered.status },
      })
    : Effect.void;

const reportFailure = (
  refused: Readonly<Pick<HttpClientError.HttpClientError, "_tag">>,
): Effect.Effect<void> =>
  logAt("Warn", { eventName: "otlp.export_failed", attributes: { "otlp.error": refused._tag } });

const reportedHttpClient = Layer.effect(
  HttpClient.HttpClient,
  Effect.map(HttpClient.HttpClient, (client) =>
    client.pipe(HttpClient.tap(reportRejection), HttpClient.tapError(reportFailure)),
  ),
).pipe(Layer.provide(FetchHttpClient.layer));

const transport = Layer.merge(OtlpSerialization.layerJson, reportedHttpClient);

const otlpExport = (exported: {
  readonly otlp?: OtlpDestination | undefined;
  readonly release: string;
  readonly service: string;
}): Layer.Layer<TelemetryFlusher> => {
  const { otlp } = exported;
  if (otlp === undefined) {
    return OtlpExporter.layerFlusher;
  }
  const shared = {
    exportInterval: Duration.infinity,
    headers: otlp.authorization === undefined ? undefined : { authorization: otlp.authorization },
    resource: { serviceName: exported.service, serviceVersion: exported.release },
  };
  const logs = Effect.map(
    OtlpLogger.make({ ...shared, url: otlpSignalUrl(otlp.endpoint, "logs") }),
    redactedLogger,
  );
  return Layer.mergeAll(
    OtlpTracer.layer({ ...shared, url: otlpSignalUrl(otlp.endpoint, "traces") }),
    Logger.layer([logs], { mergeWithExisting: true }).pipe(
      Layer.provideMerge(OtlpExporter.layerFlusher),
    ),
  ).pipe(Layer.provide(transport));
};

export { flushTelemetry, otlpExport, otlpSignalUrl };
export type { OtlpDestination, TelemetryFlusher };
