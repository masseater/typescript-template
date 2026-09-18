import type { DeclaredEnv, SharedEnv } from "./bindings.ts";
import { Email, Worker, Workers } from "alchemy/Cloudflare";
import { authSecret, otlpAuthorization, settings } from "./settings.ts";
import { loadArtifacts, repositoryRoot, workerModuleGlobs } from "./artifacts.ts";
import {
  traceDestination,
  workerCompatibilityOptions,
  workerObservability,
  workerSubdomain,
} from "./config.ts";
import type { Application } from "@template/config";
import { Effect } from "effect";
import type { Redacted } from "effect";
import type { SharedConfig } from "./config.ts";
import { databaseRef } from "./database.ts";
import { grants } from "@template/config";

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
function appEnv(target: Application, shared: SharedEnv): DeclaredEnv {
  return grants(target, "ai") ? { ...shared, AI: Workers.AI("AI") } : shared;
}

const applicationProgram = Effect.fn("applicationProgram")(function* applicationProgram(
  target: Application,
) {
  const config: SharedConfig = yield* Effect.orDie(settings);
  const secret: Redacted.Redacted = yield* authSecret;
  const authorization: Redacted.Redacted | undefined = yield* otlpAuthorization;
  const origin = config.origins[target];
  const artifacts = yield* Effect.orDie(loadArtifacts(repositoryRoot, target));
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
      ...(config.otlpEndpoint === undefined ? {} : { OTLP_ENDPOINT: config.otlpEndpoint }),
      ...(authorization === undefined ? {} : { OTLP_AUTHORIZATION: authorization }),
    }),
    main: artifacts.mainModule,
    name: `${config.prefix}-${target}`,
    observability: workerObservability(
      config.observabilitySampling,
      traceDestination(config)?.name,
    ),
    rules: [{ globs: workerModuleGlobs }],
    workersDev: workerSubdomain,
  });
  return { origin: worker.url, workerName: worker.workerName };
});

export { applicationProgram };
