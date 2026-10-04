import { Layer } from "effect";
import { FetchHttpClient } from "effect/http";
import { Otlp, OtlpSerialization } from "effect/observability";

const telemetryLive = Otlp.layerFromConfig({ resource: { serviceName: "web" } }).pipe(
  Layer.provide([FetchHttpClient.layer, OtlpSerialization.layerJson]),
);

export { telemetryLive };
