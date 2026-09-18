import { Context, Effect, Layer } from "effect";

import { otlpExport, type OtlpDestination, type TelemetryFlusher } from "./otlp.ts";
import { isRoutes, unmatchedRoute } from "./protocol.ts";
import { serviceLabel, structuredLogs, type StructuredLogOptions } from "./structured-logs.ts";
import { TelemetryInvalid } from "./telemetry-invalid.ts";

import type { ServiceName } from "@repo/config";

export class Telemetry extends Context.Service<
  Telemetry,
  {
    readonly serviceName: ServiceName;
    readonly release: string;
    readonly routes: Readonly<Record<string, string>>;
    readonly labels: Readonly<ReadonlySet<string>>;
  }
>()("@repo/observability/Telemetry") {
  public static layer(
    telemetryOptions: {
      readonly otlp?: OtlpDestination | undefined;
      readonly routes: Readonly<Record<string, string>>;
    } & StructuredLogOptions,
  ): Layer.Layer<Telemetry | TelemetryFlusher, TelemetryInvalid> {
    const { release, routes, serviceName } = telemetryOptions;
    const routeLabels = new Set([...Object.values(routes), unmatchedRoute]);
    const service = Telemetry.of({ labels: routeLabels, release, routes, serviceName });
    const telemetry = isRoutes(routes)
      ? Effect.succeed(service)
      : Effect.fail(new TelemetryInvalid({ reason: "routes" }));
    return Layer.effect(Telemetry, telemetry).pipe(
      Layer.provideMerge(
        otlpExport({ otlp: telemetryOptions.otlp, release, service: serviceLabel(serviceName) }),
      ),
      Layer.provideMerge(structuredLogs(telemetryOptions)),
    );
  }
}
