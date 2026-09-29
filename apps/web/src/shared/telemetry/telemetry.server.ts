import { Layer } from "effect";
import { layer as fetchHttpClientLayer } from "effect/unstable/http/FetchHttpClient";
import { layerFromConfig } from "effect/unstable/observability/Otlp";
import { layerJson } from "effect/unstable/observability/OtlpSerialization";

const telemetryLive = layerFromConfig({ resource: { serviceName: "web" } }).pipe(
  Layer.provide([fetchHttpClientLayer, layerJson]),
);

export { telemetryLive };
