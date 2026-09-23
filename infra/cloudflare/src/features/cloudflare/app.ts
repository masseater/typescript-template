import {
  APPLICATION,
  grants,
  jobsWorkflowClass,
  userInboxBinding,
  userInboxClassName,
} from "@repo/config";
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

import { loadArtifacts, repositoryRoot, workerModuleGlobs } from "./artifacts.ts";
import { workerCompatibilityOptions, workerObservability, workerSubdomain } from "./config.ts";
import { coreWorkerRef } from "./core-program.ts";
import { databaseRef } from "./database.ts";
import { flagshipAppRef } from "./flagship.ts";
import { memberLeavePurgeCron } from "./member-leave-purge.ts";
import { authSecret, otlpAuthorization, settings, stripeSettings } from "./settings.ts";
import { cacheNamespaceRef, fileBucketRef } from "./storage.ts";
import { accountTokenRef } from "./tokens.ts";

import type { Application } from "@repo/config";
import type { Redacted } from "effect";
import type { BillingEnv, CapabilityEnv, DeclaredEnv, SharedEnv } from "./bindings.ts";
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

function analyticsEnv(
  target: Application,
  config: SharedConfig,
): Pick<SharedEnv, "GOOGLE_ANALYTICS_MEASUREMENT_ID"> {
  if (target !== APPLICATION.user || config.googleAnalyticsMeasurementId === undefined) {
    return {};
  }
  return { GOOGLE_ANALYTICS_MEASUREMENT_ID: config.googleAnalyticsMeasurementId };
}

function otlpEnv(
  config: SharedConfig,
  authorization: Redacted.Redacted | undefined,
): Pick<SharedEnv, "OTLP_AUTHORIZATION" | "OTLP_ENABLED" | "OTLP_ENDPOINT"> {
  if (config.otlp === undefined) {
    return {};
  }
  return {
    OTLP_ENABLED: String(config.otlp.enabled),
    OTLP_ENDPOINT: config.otlp.endpoint,
    ...(authorization === undefined ? {} : { OTLP_AUTHORIZATION: authorization }),
  };
}

const wikiEnv = Effect.fn("wikiEnv")(function* wikiEnv(target: Application, shared: DeclaredEnv) {
  if (target !== APPLICATION.wiki) {
    return shared;
  }
  return {
    ...shared,
    FLAGSHIP_API_TOKEN: (yield* accountTokenRef("FlagshipWrite")).value,
    FLAGSHIP_APP_ID: shared.FLAGS.appId,
  };
});

function jobsEnv(jobsQueue: Queues.Queue | undefined): Partial<CapabilityEnv["jobs"]> {
  if (jobsQueue === undefined) {
    return {};
  }
  return {
    JOBS: jobsQueue,
    PROCESS: Workflow<{ jobId: string }>("Process", {
      className: jobsWorkflowClass,
    }),
  };
}

const applicationProgram = Effect.fn("applicationProgram")(function* applicationProgram(
  target: Application,
) {
  const config: SharedConfig = yield* Effect.orDie(settings);
  const secret: Redacted.Redacted = yield* authSecret;
  const authorization: Redacted.Redacted | undefined = yield* otlpAuthorization;
  const billing: BillingEnv | undefined = grants(target, "billing")
    ? yield* stripeSettings
    : undefined;
  const origin = config.origins[target];
  const artifacts = yield* Effect.orDie(loadArtifacts(repositoryRoot, target));
  const database = yield* databaseRef();
  const flags = yield* flagshipAppRef();
  const core = yield* coreWorkerRef();
  const email = yield* Email.SendEmail("Email", { allowedSenderAddresses: [config.mailFrom] });
  const jobsQueue = grants(target, "jobs") ? yield* Queues.Queue("Jobs", {}) : undefined;
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
      OPS_EMAIL: config.budget.recipients[0] ?? config.mailFrom,
      ...analyticsEnv(target, config),
      ...otlpEnv(config, authorization),
    },
    billing,
  );
  const env = { ...(yield* wikiEnv(target, shared)), ...jobsEnv(jobsQueue) };
  const worker = yield* Worker("Worker", {
    assets: { directory: artifacts.clientDirectory, runWorkerFirst: true },
    bundle: false,
    compatibility: workerCompatibilityOptions,
    ...(target === APPLICATION.user ? { crons: [memberLeavePurgeCron] } : {}),
    ...(target === APPLICATION.wiki ? { crons: ["*/30 * * * *"] } : {}),
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
