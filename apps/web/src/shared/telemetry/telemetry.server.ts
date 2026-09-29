import { Layer } from "effect";
import { layer as fetchHttpClientLayer } from "effect/http/FetchHttpClient";
import { layerFromConfig } from "effect/observability/Otlp";
import { layerJson } from "effect/observability/OtlpSerialization";

const telemetryLive = layerFromConfig({ resource: { serviceName: "web" } }).pipe(
  Layer.provide([fetchHttpClientLayer, layerJson]),
);

export { telemetryLive };
