import {
  APPLICATION,
  grants,
  jobsWorkflowClass,
  userInboxBinding,
  userInboxClassName,
  wikiApiBinding,
  wikiApiEntrypoint,
  wikiPagesBinding,
} from "@repo/config";
import { repositoryRoot } from "@repo/config/repository-root";
import { cacheNamespaceBinding, fileBucketBinding } from "@repo/config/storage";
import { coreEntrypoints } from "@repo/core-api/entrypoints";
import {
  DurableObject,
  Email,
  Queues,
  Worker,
  WorkerEntrypoint,
  Workers,
  Workflow,
} from "alchemy/Cloudflare";
import { Effect } from "effect";

import { loadArtifacts, workerModuleGlobs } from "./artifacts.ts";
import { billingProgram } from "./billing.ts";
import { workerCompatibilityOptions, workerObservability, workerSubdomain } from "./config.ts";
import { coreWorkerRef } from "./core-program.ts";
import { databaseRef } from "./database.ts";
import { flagshipAppRef } from "./flagship.ts";
import { memberLeavePurgeCron } from "./member-leave-purge.ts";
import { authSecret, otlpAuthorization, settings, wikiPublishSettings } from "./settings.ts";
import { cacheNamespaceRef, fileBucketRef } from "./storage.ts";
import { accountTokenRef } from "./tokens.ts";
import { wikiWorkerRef } from "./wiki-program.ts";

import type { Application } from "@repo/config";
import type { Redacted } from "effect";
import type { BillingEnv, DeclaredEnv, SharedEnv } from "./bindings.ts";
import type { SharedConfig } from "./config.ts";

function appEnv(
  target: Application,
  shared: SharedEnv,
  billing: BillingEnv | undefined,
): Effect.Effect<DeclaredEnv> {
  const withAi: DeclaredEnv = grants(target, "workers-ai")
    ? { ...shared, AI: Workers.AI("AI") }
    : shared;
  const withBilling: DeclaredEnv = { ...withAi, ...billing };
  const withRealtime: DeclaredEnv = grants(target, "realtime")
    ? {
        ...withBilling,
        [userInboxBinding]: DurableObject(userInboxBinding, { className: userInboxClassName }),
      }
    : withBilling;
  if (!grants(target, "storage")) {
    return Effect.succeed(withRealtime);
  }
  return Effect.gen(function* withStorageBindings() {
    const withStorage: DeclaredEnv = {
      ...withRealtime,
      [cacheNamespaceBinding]: yield* cacheNamespaceRef(),
      [fileBucketBinding]: yield* fileBucketRef(),
    };
    return withStorage;
  });
}

const wikiBindings = Effect.fn("wikiBindings")(function* wikiBindings() {
  const wiki = yield* wikiWorkerRef();
  return {
    [wikiApiBinding]: WorkerEntrypoint(wiki, wikiApiEntrypoint),
    [wikiPagesBinding]: WorkerEntrypoint(wiki),
  };
});

function analyticsEnv(target: Application, config: SharedConfig): Partial<SharedEnv> {
  return target === APPLICATION.user && config.googleAnalyticsMeasurementId !== undefined
    ? { GOOGLE_ANALYTICS_MEASUREMENT_ID: config.googleAnalyticsMeasurementId }
    : {};
}

function telemetryEnv(
  config: SharedConfig,
  authorization: Redacted.Redacted | undefined,
): Partial<SharedEnv> {
  if (config.otlp === undefined) {
    return {};
  }
  return {
    OTLP_ENDPOINT: config.otlp.endpoint,
    ...(authorization === undefined ? {} : { OTLP_AUTHORIZATION: authorization }),
  };
}

function operationsEmail(config: SharedConfig): string {
  return config.budget.recipients[0] ?? config.mailFrom;
}

const optionalJobsQueue = Effect.fn("optionalJobsQueue")(function* optionalJobsQueue(
  target: Application,
) {
  return grants(target, "jobs") ? yield* Queues.Queue("Jobs", {}) : undefined;
});

const targetEnv = Effect.fn("targetEnv")(function* targetEnv(
  target: Application,
  shared: DeclaredEnv,
  flags: Effect.Success<ReturnType<typeof flagshipAppRef>>,
) {
  if (target !== APPLICATION.wiki) {
    return shared;
  }
  return {
    ...shared,
    FLAGSHIP_API_TOKEN: (yield* accountTokenRef("FlagshipWrite")).value,
    FLAGSHIP_APP_ID: flags.appId,
    ...(yield* wikiBindings()),
    ...(yield* Effect.orDie(wikiPublishSettings)),
  };
});

function jobsEnv(jobsQueue: Queues.Queue | undefined) {
  return jobsQueue === undefined
    ? {}
    : {
        JOBS: jobsQueue,
        PROCESS: Workflow<{ jobId: string }>("Process", {
          className: jobsWorkflowClass,
        }),
      };
}

function workerCrons(target: Application): { crons?: string[] } {
  return {
    ...(target === APPLICATION.user ? { crons: [memberLeavePurgeCron] } : {}),
    ...(target === APPLICATION.wiki ? { crons: ["*/30 * * * *"] } : {}),
  };
}

const applicationProgram = Effect.fn("applicationProgram")(function* applicationProgram(
  target: Application,
) {
  const config: SharedConfig = yield* Effect.orDie(settings);
  const secret: Redacted.Redacted = yield* authSecret;
  const authorization: Redacted.Redacted | undefined = yield* otlpAuthorization;
  const origin = config.origins[target];
  const billing: BillingEnv | undefined = grants(target, "billing")
    ? yield* billingProgram(config.prefix, origin)
    : undefined;
  const artifacts = yield* Effect.orDie(loadArtifacts(repositoryRoot, target));
  const database = yield* databaseRef();
  const flags = yield* flagshipAppRef();
  const core = yield* coreWorkerRef();
  const email = yield* Email.SendEmail("Email", { allowedSenderAddresses: [config.mailFrom] });
  const jobsQueue = yield* optionalJobsQueue(target);
  const shared: DeclaredEnv = yield* appEnv(
    target,
    {
      APP_ORIGIN: origin,
      APP_RELEASE: artifacts.release,
      AUTH_SECRET: secret,
      CORE: WorkerEntrypoint(core, coreEntrypoints[target]),
      DB: database,
      EMAIL: email,
      EMAIL_FROM: config.mailFrom,
      FLAGSHIP_ACCOUNT_ID: config.accountId,
      FLAGS: flags,
      OPS_EMAIL: operationsEmail(config),
      ...analyticsEnv(target, config),
      ...telemetryEnv(config, authorization),
    },
    billing,
  );
  const env = {
    ...(yield* targetEnv(target, shared, flags)),
    ...jobsEnv(jobsQueue),
  };
  const worker = yield* Worker("Worker", {
    assets: { directory: artifacts.clientDirectory, runWorkerFirst: true },
    bundle: false,
    compatibility: workerCompatibilityOptions,
    ...workerCrons(target),
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
