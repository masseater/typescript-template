import { Worker } from "alchemy/Cloudflare";
import { Effect } from "effect";

import { coreArtifact } from "./artifacts.ts";
import { workerCompatibilityOptions, workerObservability, workerSubdomain } from "./config.ts";
import { databaseRef } from "./database.ts";
import { settings } from "./settings.ts";
import { stackName } from "./stacks.ts";

const coreWorkerResource = "Worker";

const coreProgram = Effect.fn("coreProgram")(function* coreProgram() {
  const config = yield* Effect.orDie(settings);
  const database = yield* databaseRef();
  const worker = yield* Worker(coreWorkerResource, {
    bundle: false,
    compatibility: workerCompatibilityOptions,
    env: { DB: database },
    main: coreArtifact(),
    name: `${config.prefix}-core`,
    observability: workerObservability(config),
    workersDev: workerSubdomain,
  });
  return { worker, workerName: worker.workerName };
});

function coreWorkerRef(): Effect.Effect<Worker> {
  return Worker.ref(coreWorkerResource, { stack: stackName("core") });
}

export { coreProgram, coreWorkerRef };
