import { Context, Effect, Layer } from "effect";

import { otlpExport } from "./otlp.ts";
import { isRoutes } from "./protocol.ts";
import { serviceLabel, structuredLogs } from "./structured-logs.ts";
import { TelemetryInvalid } from "./telemetry-invalid.ts";

import type { Application } from "@repo/config";
import type { OtlpDestination, TelemetryFlusher } from "./otlp.ts";
import type { StructuredLogOptions } from "./structured-logs.ts";

interface TelemetryShape {
  readonly serviceName: Application;
  readonly release: string;
  readonly routes: Readonly<Record<string, string>>;
  readonly labels: Readonly<ReadonlySet<string>>;
}
interface TelemetryOptions extends StructuredLogOptions {
  readonly otlp?: OtlpDestination | undefined;
  readonly routes: Readonly<Record<string, string>>;
}

class Telemetry extends Context.Service<Telemetry, TelemetryShape>()(
  "@repo/observability/Telemetry",
) {
  public static layer(
    options: TelemetryOptions,
  ): Layer.Layer<Telemetry | TelemetryFlusher, TelemetryInvalid> {
    const { release, routes, serviceName } = options;
    const labels = new Set([...Object.values(routes), "unmatched"]);
    const service = serviceLabel(serviceName);
    const telemetry = isRoutes(routes)
      ? Effect.succeed(Telemetry.of({ labels, release, routes, serviceName }))
      : Effect.fail(new TelemetryInvalid({ reason: "routes" }));
    return Layer.effect(Telemetry, telemetry).pipe(
      Layer.provideMerge(otlpExport({ otlp: options.otlp, release, service })),
      Layer.provideMerge(structuredLogs(options)),
    );
  }
}

export { Telemetry };
