import { Layer } from "effect";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as Otlp from "effect/observability/Otlp";
import * as OtlpSerialization from "effect/observability/OtlpSerialization";

export const telemetryLive = Otlp.layerFromConfig({ resource: { serviceName: "web" } }).pipe(
  Layer.provide([FetchHttpClient.layer, OtlpSerialization.layerJson]),
);
