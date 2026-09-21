import { APPLICATION, grants } from "@repo/config";
import { photoBucketBinding } from "@repo/config/storage";
import { Email, Worker, Workers } from "alchemy/Cloudflare";
import { Effect } from "effect";

import { loadArtifacts, repositoryRoot, workerModuleGlobs } from "./artifacts.ts";
import { workerCompatibilityOptions, workerObservability, workerSubdomain } from "./config.ts";
import { databaseRef } from "./database.ts";
import { flagshipAppRef } from "./flagship.ts";
import { memberLeavePurgeCron } from "./member-leave-purge.ts";
import { authSecret, otlpAuthorization, settings, stripeSettings } from "./settings.ts";
import { photoBucketRef } from "./storage.ts";
import { accountTokenRef } from "./tokens.ts";

import type { Application } from "@repo/config";
import type { R2 } from "alchemy/Cloudflare";
import type { Redacted } from "effect";
import type { BillingEnv, DeclaredEnv, SharedEnv, WikiEnv } from "./bindings.ts";
import type { SharedConfig } from "./config.ts";

const appEnv = Effect.fn("appEnv")(function* appEnv(
  target: Application,
  shared: SharedEnv,
  billing: BillingEnv | undefined,
) {
  const ai = grants(target, "ai") ? { AI: Workers.AI("AI") } : {};
  const storage: Partial<Record<typeof photoBucketBinding, R2.Bucket>> = grants(target, "storage")
    ? { [photoBucketBinding]: yield* photoBucketRef() }
    : {};
  return { ...shared, ...ai, ...storage, ...(billing ?? {}) } satisfies DeclaredEnv;
});

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
  const email = yield* Email.SendEmail("Email", { allowedSenderAddresses: [config.mailFrom] });
  const shared = yield* appEnv(
    target,
    {
      APP_ORIGIN: origin,
      APP_RELEASE: artifacts.release,
      AUTH_SECRET: secret,
      DB: database,
      EMAIL: email,
      EMAIL_FROM: config.mailFrom,
      FLAGSHIP_ACCOUNT_ID: config.accountId,
      FLAGS: flags,
      OPS_EMAIL: config.budget.recipients[0] ?? config.mailFrom,
      ...(target === APPLICATION.user && config.googleAnalyticsMeasurementId !== undefined
        ? { GOOGLE_ANALYTICS_MEASUREMENT_ID: config.googleAnalyticsMeasurementId }
        : {}),
      ...(config.otlp === undefined
        ? {}
        : {
            OTLP_ENABLED: String(config.otlp.enabled),
            OTLP_ENDPOINT: config.otlp.endpoint,
            ...(authorization === undefined ? {} : { OTLP_AUTHORIZATION: authorization }),
          }),
    },
    billing,
  );
  const env: DeclaredEnv | WikiEnv =
    target === APPLICATION.wiki
      ? {
          ...shared,
          FLAGSHIP_API_TOKEN: (yield* accountTokenRef("FlagshipWrite")).value,
          FLAGSHIP_APP_ID: flags.appId,
        }
      : shared;
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
  return { origin: worker.url, workerName: worker.workerName };
});

export { applicationProgram };
