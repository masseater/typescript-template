import { Telemetry } from "@repo/observability";
import { Layer } from "effect";

import { Assets } from "./assets.ts";

import type { SiteConfig } from "@repo/config";
import type { TelemetryFlusher, TelemetryInvalid } from "@repo/observability";

type SiteServices = Assets | Telemetry | TelemetryFlusher;

function configuredSiteLayer(
  config: SiteConfig,
  serviceName: string,
  routes: Readonly<Record<string, string>>,
): Layer.Layer<SiteServices, TelemetryInvalid> {
  const otlp =
    config.OTLP_ENDPOINT === undefined || config.OTLP_ENABLED === "false"
      ? undefined
      : { authorization: config.OTLP_AUTHORIZATION, endpoint: config.OTLP_ENDPOINT };
  const telemetry = Telemetry.layer({ otlp, release: config.APP_RELEASE, routes, serviceName });
  return Layer.succeed(Assets, config.ASSETS).pipe(Layer.provideMerge(telemetry));
}

export { configuredSiteLayer };
export type { SiteServices };
