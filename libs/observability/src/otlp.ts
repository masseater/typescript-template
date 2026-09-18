import { Duration, Layer } from "effect";
import {
  OtlpExporter,
  OtlpLogger,
  OtlpSerialization,
  OtlpTracer,
} from "effect/unstable/observability";
import { FetchHttpClient } from "effect/unstable/http";

interface OtlpDestination {
  readonly endpoint: string;
  readonly authorization?: string | undefined;
}
interface OtlpOptions {
  readonly otlp?: OtlpDestination | undefined;
  readonly release: string;
  readonly service: string;
}

const trailingSlashes = /\/+$/u;
const transport = Layer.merge(OtlpSerialization.layerJson, FetchHttpClient.layer);

function signalUrl(endpoint: string, signal: string): string {
  return `${endpoint.replace(trailingSlashes, "")}/v1/${signal}`;
}

function otlpExport(options: OtlpOptions): Layer.Layer<OtlpExporter.Flusher> {
  const { otlp } = options;
  if (otlp === undefined) {
    return OtlpExporter.layerFlusher;
  }
  const shared = {
    exportInterval: Duration.infinity,
    headers: otlp.authorization === undefined ? undefined : { authorization: otlp.authorization },
    resource: { serviceName: options.service, serviceVersion: options.release },
  };
  return Layer.mergeAll(
    OtlpTracer.layer({ ...shared, url: signalUrl(otlp.endpoint, "traces") }),
    OtlpLogger.layer({ ...shared, url: signalUrl(otlp.endpoint, "logs") }),
  ).pipe(Layer.provide(transport));
}

export { otlpExport };
export type { OtlpDestination };
