import { Context, Effect, Layer } from "effect";

import { isRoutes, unmatchedRoute } from "./protocol.ts";
import { structuredLogs, type StructuredLogOptions } from "./structured-logs.ts";
import { TelemetryInvalid } from "./telemetry-invalid.ts";

import type { Application } from "@template/config";

export class Telemetry extends Context.Service<
  Telemetry,
  {
    readonly serviceName: Application;
    readonly release: string;
    readonly routes: Readonly<Record<string, string>>;
    readonly labels: Readonly<ReadonlySet<string>>;
  }
>()("@template/observability/Telemetry") {
  public static layer(
    telemetryOptions: { readonly routes: Readonly<Record<string, string>> } & StructuredLogOptions,
  ): Layer.Layer<Telemetry, TelemetryInvalid> {
    const { release, routes, serviceName } = telemetryOptions;
    const routeLabels = new Set([...Object.values(routes), unmatchedRoute]);
    const service = Telemetry.of({ labels: routeLabels, release, routes, serviceName });
    const telemetry = isRoutes(routes)
      ? Effect.succeed(service)
      : Effect.fail(new TelemetryInvalid({ reason: "routes" }));
    return Layer.effect(Telemetry, telemetry).pipe(
      Layer.provideMerge(structuredLogs(telemetryOptions)),
    );
  }
}
