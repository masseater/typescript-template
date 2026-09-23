import { Context, Effect, Layer } from "effect";

import { otlpExport, type OtlpDestination, type TelemetryFlusher } from "./otlp.ts";
import { isRoutes } from "./protocol.ts";
import { serviceLabel, structuredLogs, type StructuredLogOptions } from "./structured-logs.ts";
import { TelemetryInvalid } from "./telemetry-invalid.ts";

import type { ServiceName } from "./service-name.ts";
class Telemetry extends Context.Service<
  Telemetry,
  {
    readonly serviceName: ServiceName;
    readonly release: string;
    readonly routes: Readonly<Record<string, string>>;
    readonly labels: Readonly<ReadonlySet<string>>;
  }
>()("@repo/observability/Telemetry") {
  public static layer(
    settings: StructuredLogOptions & {
      readonly otlp?: OtlpDestination | undefined;
      readonly routes: Readonly<Record<string, string>>;
    },
  ): Layer.Layer<Telemetry | TelemetryFlusher, TelemetryInvalid> {
    const { release, routes, serviceName } = settings;
    const attributeLabels = new Set([...Object.values(routes), "unmatched"]);
    const service = serviceLabel(serviceName);
    const telemetry = isRoutes(routes)
      ? Effect.succeed(Telemetry.of({ labels: attributeLabels, release, routes, serviceName }))
      : Effect.fail(new TelemetryInvalid({ reason: "routes" }));
    return Layer.effect(Telemetry, telemetry).pipe(
      Layer.provideMerge(otlpExport({ otlp: settings.otlp, release, service })),
      Layer.provideMerge(structuredLogs(settings)),
    );
  }
}
export { Telemetry };
