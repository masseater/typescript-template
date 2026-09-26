#!/usr/bin/env node

import { markFailed, reportFailed, runCli } from "@repo/cli";
import { APPLICATION, appEnvKey, applications, wikiWorker } from "@repo/config";
import { repositoryRoot } from "@repo/config/repository-root";
import {
  budgetMonitorEnv,
  budgetMonitorWorker,
  errorMonitorEnv,
  errorMonitorWorker,
  healthMonitorWorker,
  healthOriginKey,
} from "@repo/monitor/workers";
import { deploymentKey } from "@repo/observability/deployment-keys";
import { Cause, Console, Effect, Equal, Schema } from "effect";

import { loadArtifacts } from "./artifacts.ts";
import { hstsSetting } from "./config.ts";
import { assertCoreNotPublic } from "./core-guard.ts";
import {
  accountToken,
  applicationResource,
  billingResources,
  declaredStack,
  jobsResources,
  monitorResource,
  plainText,
  sharedWorker,
  tokenValue,
  traceDestination,
  zoneSetting,
} from "./expected-resources.ts";
import {
  applyVerificationEnvironment,
  bindsSendEmail,
  compileStack,
  describeInventoryCause,
} from "./inventory.ts";
import { encodeJson } from "./platform.ts";
import {
  applyOrderViolations,
  onboardingStack,
  sendingStacks,
  stackName,
  stackNames,
} from "./stacks.ts";
import { cacheNamespaceTitle, fileBucketName } from "./storage.ts";
import { verificationSettings } from "./verification-settings.ts";

import type { Application } from "@repo/config";
import type { ResourceInventory } from "./expected-resources.ts";

const { accountId, budget, mailFrom, origins, otlp, otlpAuthorization, prefix } =
  verificationSettings;

const SENDING_SUBDOMAIN = "Cloudflare.Email.SendingSubdomain";

const isApplication = Schema.is(Schema.Literals(applications));
import type { StackInventory } from "./inventory.ts";
import type { StackName } from "./stacks.ts";

const applicationStack = Effect.fn("applicationStack")(function* applicationStack(
  app: Application,
) {
  const artifacts = yield* loadArtifacts(repositoryRoot, app);
  return declaredStack(app, {
    ...billingResources(app),
    ...jobsResources(app),
    Worker: applicationResource(app, artifacts.release),
  });
});

const wikiStack = Effect.fn("wikiStack")(function* wikiStack() {
  const artifacts = yield* loadArtifacts(repositoryRoot, wikiWorker);
  return declaredStack(wikiWorker, {
    Worker: {
      adopt: false,
      bindings: [
        "AI:ai",
        plainText(appEnvKey.appRelease, artifacts.release),
        `${appEnvKey.otlpAuthorization}:secret_text:text=$${deploymentKey.otlpAuthorization}`,
        plainText(appEnvKey.otlpEndpoint, otlp.endpoint),
      ].toSorted(),
      declared: {
        ...sharedWorker,
        assets: {
          directory: `infra/cloudflare/.artifacts/${wikiWorker}/<digest>/client`,
          runWorkerFirst: true,
        },
        bundle: false,
        main: `infra/cloudflare/.artifacts/${wikiWorker}/<digest>/server/index.js`,
        name: `${prefix}-${wikiWorker}`,
        rules: [{ globs: ["**/*.js", "**/*.mjs", "**/*.txt", "**/*.wasm", "**/*.map"] }],
      },
      removalPolicy: "destroy",
      type: "Cloudflare.Worker",
    },
  });
});

const staticExpected: Readonly<
  Record<Exclude<StackName, Application | "flagship" | typeof wikiWorker>, StackInventory>
> = {
  core: declaredStack("core", {
    Worker: {
      adopt: false,
      bindings: [
        `${appEnvKey.authSecret}:secret_text:text=$${deploymentKey.authSecret}`,
        `DB:d1:databaseId=${stackName("database")}.Database.databaseId`,
        `EMAIL:send_email:allowedSenderAddresses=${mailFrom}`,
        plainText(appEnvKey.emailFrom, mailFrom),
      ].toSorted(),
      declared: {
        ...sharedWorker,
        bundle: false,
        main: "apps/core/dist/index.js",
        name: `${prefix}-core`,
      },
      removalPolicy: "destroy",
      type: "Cloudflare.Worker",
    },
  }),
  "budget-monitor": declaredStack("budget-monitor", {
    Worker: monitorResource({
      artifact: "infra/budget-monitor/dist/index.js",
      className: budgetMonitorWorker.className,
      cron: budgetMonitorWorker.cron,
      name: budgetMonitorWorker.name,
      variables: [
        tokenValue(budgetMonitorEnv.billingReadToken, "BillingRead"),
        plainText(budgetMonitorEnv.budgetJpy, budget.budgetJpy),
        plainText(budgetMonitorEnv.accountId, accountId),
      ],
    }),
  }),
  database: declaredStack("database", {
    Database: {
      adopt: false,
      bindings: [],
      declared: { migrations: "libs/db/migrations/", name: `${prefix}-db` },
      removalPolicy: "retain",
      type: "Cloudflare.D1Database",
    },
  }),
  email: declaredStack("email", {
    ...Object.fromEntries(
      budget.recipients.map((recipient, index) => [
        `Alert${index + 1}`,
        {
          adopt: false,
          bindings: [],
          declared: { email: recipient },
          removalPolicy: "retain",
          type: "Cloudflare.Email.Address",
        } satisfies ResourceInventory,
      ]),
    ),
    Sending: {
      adopt: false,
      bindings: [],
      declared: { name: "template-verify.example.com", zoneId: verificationSettings.zoneId },
      removalPolicy: "retain",
      type: SENDING_SUBDOMAIN,
    },
  }),
  "error-monitor": declaredStack("error-monitor", {
    Worker: monitorResource({
      artifact: "infra/error-monitor/dist/index.js",
      className: errorMonitorWorker.className,
      cron: errorMonitorWorker.cron,
      name: errorMonitorWorker.name,
      variables: [
        plainText(errorMonitorEnv.accountId, accountId),
        tokenValue(errorMonitorEnv.observabilityToken, "ObservabilityQuery"),
      ],
    }),
  }),
  "health-monitor": declaredStack("health-monitor", {
    Worker: monitorResource({
      artifact: "infra/health-monitor/dist/index.js",
      className: healthMonitorWorker.className,
      cron: healthMonitorWorker.cron,
      name: healthMonitorWorker.name,
      variables: [
        plainText(healthOriginKey[APPLICATION.admin], origins[APPLICATION.admin]),
        plainText(healthOriginKey[APPLICATION.user], origins[APPLICATION.user]),
        plainText(healthOriginKey[APPLICATION.wiki], origins[APPLICATION.wiki]),
      ],
    }),
  }),
  observability: declaredStack("observability", {
    Traces: {
      adopt: false,
      bindings: [],
      declared: {
        enabled: true,
        headers: { authorization: otlpAuthorization },
        logpushDataset: "opentelemetry-traces",
        name: traceDestination,
        url: `${otlp.endpoint}/v1/traces`,
      },
      removalPolicy: "destroy",
      type: "Cloudflare.Workers.ObservabilityDestination",
    },
  }),
  storage: declaredStack("storage", {
    Cache: {
      adopt: false,
      bindings: [],
      declared: { title: cacheNamespaceTitle(prefix) },
      removalPolicy: "retain",
      type: "Cloudflare.KV.Namespace",
    },
    Files: {
      adopt: false,
      bindings: [],
      declared: { name: fileBucketName(prefix) },
      removalPolicy: "retain",
      type: "Cloudflare.R2.Bucket",
    },
  }),
  tokens: declaredStack("tokens", {
    BillingRead: accountToken("billing-read", "Billing Read"),
    FlagshipWrite: accountToken("flagship-write", {
      id: "521a41dc78f94eaba5e643528846cb7b",
    }),
    ObservabilityQuery: accountToken("observability-query", "Workers Observability Write"),
  }),
  zone: declaredStack("zone", {
    AlwaysUseHttps: zoneSetting("always_use_https", "on"),
    SecurityHeader: zoneSetting("security_header", hstsSetting),
  }),
};

const expectedStack = Effect.fn("expectedStack")(function* expectedStack(stack: StackName) {
  if (isApplication(stack)) {
    return yield* applicationStack(stack);
  }
  if (stack === "flagship") {
    return yield* compileStack(stack);
  }
  if (stack === wikiWorker) {
    return yield* wikiStack();
  }
  return staticExpected[stack];
});

applyVerificationEnvironment();

function onboards(inventory: StackInventory): boolean {
  return Object.values(inventory.resources).some((resource) => resource.type === SENDING_SUBDOMAIN);
}

const rolesDiffer = Effect.fn("rolesDiffer")(function* rolesDiffer(
  verified: readonly Readonly<{ onboards: boolean; sends: boolean }>[],
) {
  const onboarding = stackNames.filter((_stack, index) => verified[index]?.onboards === true);
  const senders = stackNames.filter((_stack, index) => verified[index]?.sends === true);
  const violations = applyOrderViolations(stackNames);
  const differs =
    violations.length > 0 ||
    !Equal.equals(onboarding, [onboardingStack]) ||
    !Equal.equals(senders.toSorted(), [...sendingStacks].toSorted());
  if (differs) {
    yield* Console.error(
      yield* encodeJson({ event: "stacks.roles_differ", onboarding, senders, violations }),
    );
  }
  return differs;
});

function coreViolationOf(stack: StackName, inventory: StackInventory): string | undefined {
  return stack === "core" || stack === wikiWorker ? assertCoreNotPublic(inventory) : undefined;
}

const reportCoreViolation = Effect.fn("reportCoreViolation")(function* reportCoreViolation(
  stack: StackName,
  violation: string | undefined,
) {
  if (violation !== undefined) {
    yield* Console.error(yield* encodeJson({ event: "core.public_entry", stack, violation }));
  }
});

const verifyStack = Effect.fn("verifyStack")(function* verifyStack(stack: StackName) {
  const inventory = yield* compileStack(stack);
  const expected = yield* expectedStack(stack);
  const coreViolation = coreViolationOf(stack, inventory);
  const matches = coreViolation === undefined && Equal.equals(inventory, expected);
  yield* reportCoreViolation(stack, coreViolation);
  if (!matches) {
    yield* Console.error(
      yield* encodeJson({ actual: inventory, event: "stacks.differs", expected, stack }),
    );
  }
  return {
    matches,
    onboards: onboards(inventory),
    sends: bindsSendEmail(inventory),
  } as const;
});

runCli(
  Effect.gen(function* program() {
    const verified = yield* Effect.forEach(stackNames, (stack) => verifyStack(stack));
    const differs = yield* rolesDiffer(verified);
    if (differs || verified.some((entry) => !entry.matches)) {
      yield* markFailed;
      return;
    }
    yield* Console.log(yield* encodeJson({ event: "stacks.verified", stacks: stackNames.length }));
  }).pipe(
    Effect.catchTag("InventoryFailure", (failure) =>
      reportFailed({
        code: failure.code,
        detail: failure.detail,
        event: "stacks.invalid",
        stack: failure.stack,
      }),
    ),
  ),
  (cause) => ({ detail: describeInventoryCause(Cause.squash(cause)), event: "stacks.invalid" }),
);
