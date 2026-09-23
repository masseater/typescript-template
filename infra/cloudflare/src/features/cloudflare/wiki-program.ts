import { wikiWorker } from "@repo/config";
import { Worker, Workers } from "alchemy/Cloudflare";
import { Effect } from "effect";

import { loadArtifacts, repositoryRoot, workerModuleGlobs } from "./artifacts.ts";
import { workerCompatibilityOptions, workerObservability, workerSubdomain } from "./config.ts";
import { otlpAuthorization, settings } from "./settings.ts";
import { stackName } from "./stacks.ts";

const wikiWorkerResource = "Worker";

const wikiProgram = Effect.fn("wikiProgram")(function* wikiProgram() {
  const config = yield* Effect.orDie(settings);
  const authorization = yield* otlpAuthorization;
  const artifacts = yield* Effect.orDie(loadArtifacts(repositoryRoot, wikiWorker));
  const worker = yield* Worker(wikiWorkerResource, {
    assets: { directory: artifacts.clientDirectory, runWorkerFirst: true },
    bundle: false,
    compatibility: workerCompatibilityOptions,
    env: {
      AI: Workers.AI("AI"),
      APP_RELEASE: artifacts.release,
      ...(config.otlp === undefined
        ? {}
        : {
            OTLP_ENABLED: String(config.otlp.enabled),
            OTLP_ENDPOINT: config.otlp.endpoint,
            ...(authorization === undefined ? {} : { OTLP_AUTHORIZATION: authorization }),
          }),
    },
    main: artifacts.mainModule,
    name: `${config.prefix}-${wikiWorker}`,
    observability: workerObservability(config),
    rules: [{ globs: workerModuleGlobs }],
    workersDev: workerSubdomain,
  });
  return { workerName: worker.workerName };
});

function wikiWorkerRef(): Effect.Effect<Worker> {
  return Worker.ref(wikiWorkerResource, { stack: stackName(wikiWorker) });
}

export { wikiProgram, wikiWorkerRef };
