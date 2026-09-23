import { readSiteEnvironment, wikiWorker } from "@repo/config";
import { configuredSiteLayer } from "@repo/runtime/worker";
import { Effect, Layer } from "effect";

import { Embedder, embedWith } from "./embedder.ts";

import type { ConfigurationInvalid } from "@repo/config";
import type { TelemetryInvalid } from "@repo/observability";
import type { SiteServices } from "@repo/runtime/worker";

const wikiService = wikiWorker;

type WikiServices = SiteServices | Embedder;

function wikiLayer(
  env: unknown,
  routes: Readonly<Record<string, string>>,
): Layer.Layer<WikiServices, ConfigurationInvalid | TelemetryInvalid> {
  return Layer.unwrap(
    readSiteEnvironment(env).pipe(
      Effect.map((config) =>
        Layer.mergeAll(
          Layer.succeed(
            Embedder,
            Embedder.of({ available: config.AI !== undefined, embed: embedWith(config.AI) }),
          ),
          configuredSiteLayer({ siteConfig: config, serviceName: wikiService, routes }),
        ),
      ),
    ),
  );
}

export { wikiLayer, wikiService };
export type { WikiServices };
