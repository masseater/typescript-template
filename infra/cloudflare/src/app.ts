import type { AppEnv, WikiEnv } from "./bindings.ts";
import { Email, Worker, Workers } from "alchemy/Cloudflare";
import { authSecret, settings } from "./settings.ts";
import { loadArtifacts, repositoryRoot, workerModuleGlobs } from "./artifacts.ts";
import { workerCompatibilityOptions, workerObservability, workerSubdomain } from "./config.ts";
import type { Application } from "@template/config";
import { Effect } from "effect";
import type { Redacted } from "effect";
import type { SharedConfig } from "./config.ts";
import { archiveSourceMaps } from "./source-maps.ts";
import { databaseRef } from "./database.ts";

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
function appEnv(target: Application, shared: AppEnv): Partial<WikiEnv> & AppEnv {
  return target === "wiki" ? { ...shared, AI: Workers.AI("AI") } : shared;
}

const applicationProgram = Effect.fn("applicationProgram")(function* applicationProgram(
  target: Application,
) {
  const config: SharedConfig = yield* settings;
  const secret: Redacted.Redacted = yield* authSecret;
  const origin = config.origins[target];
  const artifacts = yield* Effect.orDie(loadArtifacts(repositoryRoot, target));
  yield* Effect.orDie(archiveSourceMaps(repositoryRoot, target, artifacts.release));
  const database = yield* databaseRef();
  const email = yield* Email.SendEmail("Email", { allowedSenderAddresses: [config.mailFrom] });
  const worker = yield* Worker("Worker", {
    assets: { directory: artifacts.clientDirectory, runWorkerFirst: true },
    bundle: false,
    compatibility: workerCompatibilityOptions,
    domain: { name: new URL(origin).hostname, zoneId: config.zoneId },
    env: appEnv(target, {
      APP_ORIGIN: origin,
      APP_RELEASE: artifacts.release,
      AUTH_SECRET: secret,
      DB: database,
      EMAIL: email,
      EMAIL_FROM: config.mailFrom,
    }),
    main: artifacts.mainModule,
    name: `${config.prefix}-${target}`,
    observability: workerObservability,
    rules: [{ globs: workerModuleGlobs }],
    workersDev: workerSubdomain,
  });
  return { origin: worker.url, workerName: worker.workerName };
});

export { applicationProgram };
