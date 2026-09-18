import { Duration, Effect, Layer, Logger } from "effect";
import { FetchHttpClient, HttpClient } from "effect/unstable/http";
import {
  OtlpExporter,
  OtlpLogger,
  OtlpSerialization,
  OtlpTracer,
} from "effect/unstable/observability";

import { annotateLogs } from "./annotations.ts";
import { httpStatus } from "./http-status.ts";
import { redactedLogger } from "./structured-logs.ts";

import type { HttpClientError, HttpClientResponse } from "effect/unstable/http";

interface OtlpDestination {
  readonly endpoint: string;
  readonly authorization?: string | undefined;
}
interface OtlpOptions {
  readonly otlp?: OtlpDestination | undefined;
  readonly release: string;
  readonly service: string;
}

type TelemetryFlusher = OtlpExporter.Flusher;

const trailingSlashes = /\/+$/u;
const flushTelemetry = Effect.flatMap(OtlpExporter.Flusher, (flusher) => flusher.flush);

function otlpSignalUrl(endpoint: string, signal: "logs" | "traces"): string {
  return `${endpoint.replace(trailingSlashes, "")}/v1/${signal}`;
}

function reportRejection(
  response: Readonly<Pick<HttpClientResponse.HttpClientResponse, "status">>,
): Effect.Effect<void> {
  return response.status >= httpStatus.badRequest
    ? Effect.logWarning("otlp.export_failed").pipe(annotateLogs({ "otlp.status": response.status }))
    : Effect.void;
}

function reportFailure(
  error: Readonly<Pick<HttpClientError.HttpClientError, "_tag">>,
): Effect.Effect<void> {
  return Effect.logWarning("otlp.export_failed").pipe(annotateLogs({ "otlp.error": error._tag }));
}

const reportedHttpClient = Layer.effect(
  HttpClient.HttpClient,
  Effect.map(HttpClient.HttpClient, (client) =>
    client.pipe(HttpClient.tap(reportRejection), HttpClient.tapError(reportFailure)),
  ),
).pipe(Layer.provide(FetchHttpClient.layer));

const transport = Layer.merge(OtlpSerialization.layerJson, reportedHttpClient);

function otlpExport(options: OtlpOptions): Layer.Layer<TelemetryFlusher> {
  const { otlp } = options;
  if (otlp === undefined) {
    return OtlpExporter.layerFlusher;
  }
  const shared = {
    exportInterval: Duration.infinity,
    headers: otlp.authorization === undefined ? undefined : { authorization: otlp.authorization },
    resource: { serviceName: options.service, serviceVersion: options.release },
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
}

export { flushTelemetry, otlpExport, otlpSignalUrl };
export type { OtlpDestination, TelemetryFlusher };
