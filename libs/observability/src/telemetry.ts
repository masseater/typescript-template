import { Context, Effect, Layer } from "effect";

import { isRoutes } from "./protocol.ts";
import { structuredLogs } from "./structured-logs.ts";
import { TelemetryInvalid } from "./telemetry-invalid.ts";

import type { Application } from "@template/config";
import type { StructuredLogOptions } from "./structured-logs.ts";

type TelemetryShape = {
  readonly serviceName: Application;
  readonly release: string;
  readonly routes: Readonly<Record<string, string>>;
  readonly labels: Readonly<ReadonlySet<string>>;
};
type TelemetryOptions = {
  readonly routes: Readonly<Record<string, string>>;
} & StructuredLogOptions;

class Telemetry extends Context.Service<Telemetry, TelemetryShape>()(
  "@template/observability/Telemetry",
) {
  public static layer(options: TelemetryOptions): Layer.Layer<Telemetry, TelemetryInvalid> {
    const { release, routes, serviceName } = options;
    const labels = new Set([...Object.values(routes), "unmatched"]);
    const service = Telemetry.of({ labels, release, routes, serviceName });
    const telemetry = isRoutes(routes)
      ? Effect.succeed(service)
      : Effect.fail(new TelemetryInvalid({ reason: "routes" }));
    return Layer.effect(Telemetry, telemetry).pipe(Layer.provideMerge(structuredLogs(options)));
  }
}

export { Telemetry };
