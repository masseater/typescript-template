import { APPLICATION, grants, jobsWorkflowClass } from "@repo/config";
import { Email, Queues, Worker, Workers, Workflow } from "alchemy/Cloudflare";
import { Effect } from "effect";

import { loadArtifacts, repositoryRoot, workerModuleGlobs } from "./artifacts.ts";
import { workerCompatibilityOptions, workerObservability, workerSubdomain } from "./config.ts";
import { databaseRef } from "./database.ts";
import { flagshipAppRef } from "./flagship.ts";
import { authSecret, otlpAuthorization, settings } from "./settings.ts";
import { accountTokenRef } from "./tokens.ts";

import type { Application } from "@repo/config";
import type { Redacted } from "effect";
import type { DeclaredEnv, SharedEnv, WikiEnv } from "./bindings.ts";
import type { SharedConfig } from "./config.ts";

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
  const flags = yield* flagshipAppRef();
  const email = yield* Email.SendEmail("Email", { allowedSenderAddresses: [config.mailFrom] });
  const jobsQueue = grants(target, "jobs") ? yield* Queues.Queue("Jobs", {}) : undefined;
  const shared = appEnv(target, {
    APP_ORIGIN: origin,
    APP_RELEASE: artifacts.release,
    AUTH_SECRET: secret,
    DB: database,
    EMAIL: email,
    EMAIL_FROM: config.mailFrom,
    FLAGSHIP_ACCOUNT_ID: config.accountId,
    FLAGS: flags,
    OPS_EMAIL: config.budget.recipients[0] ?? config.mailFrom,
    ...(config.otlp === undefined
      ? {}
      : {
          OTLP_ENABLED: String(config.otlp.enabled),
          OTLP_ENDPOINT: config.otlp.endpoint,
          ...(authorization === undefined ? {} : { OTLP_AUTHORIZATION: authorization }),
        }),
  });
  const baseEnv: DeclaredEnv | WikiEnv =
    target === APPLICATION.wiki
      ? {
          ...shared,
          FLAGSHIP_API_TOKEN: (yield* accountTokenRef("FlagshipWrite")).value,
          FLAGSHIP_APP_ID: flags.appId,
        }
      : shared;
  const env = {
    ...baseEnv,
    ...(jobsQueue === undefined
      ? {}
      : {
          JOBS: jobsQueue,
          PROCESS: Workflow<{ jobId: string }>("Process", {
            className: jobsWorkflowClass,
          }),
        }),
  };
  const worker = yield* Worker("Worker", {
    assets: { directory: artifacts.clientDirectory, runWorkerFirst: true },
    bundle: false,
    compatibility: workerCompatibilityOptions,
    domain: { name: new URL(origin).hostname, zoneId: config.zoneId },
    env,
    main: artifacts.mainModule,
    name: `${config.prefix}-${target}`,
    observability: workerObservability(config),
    rules: [{ globs: workerModuleGlobs }],
    workersDev: workerSubdomain,
  });
  if (jobsQueue !== undefined) {
    yield* Queues.Consumer("JobsConsumer", {
      queueId: jobsQueue.queueId,
      scriptName: worker.workerName,
    });
  }
  return { origin: worker.url, workerName: worker.workerName };
});

export { applicationProgram };
