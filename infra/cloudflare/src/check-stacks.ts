#!/usr/bin/env node
import { isDeepStrictEqual } from "node:util";

import { budgetMonitorEnv, budgetMonitorWorker } from "@repo/budget-monitor/config";
import { markFailed, reportFailed, runCli } from "@repo/cli";
import { APPLICATION, appEnvKey, applications, grants } from "@repo/config";
import { workerCompatibility } from "@repo/config/worker";
import { errorMonitorEnv, errorMonitorWorker } from "@repo/error-monitor/config";
import { healthMonitorWorker, healthOriginKey } from "@repo/health-monitor/config";
import { deploymentKey } from "@repo/observability/deployment-keys";
import { Cause, Console, Effect, Schema } from "effect";

import { loadArtifacts, repositoryRoot } from "./artifacts.ts";
import { hstsSetting } from "./config.ts";
import {
  applyVerificationEnvironment,
  bindsSendEmail,
  compileStack,
  describeCause,
} from "./inventory.ts";
import {
  applyOrderViolations,
  onboardingStack,
  sendingStacks,
  stackName,
  stackNames,
  stackReferences,
} from "./stacks.ts";
import { verificationSettings } from "./verification-fixture.ts";

import type { Application } from "@repo/config";
import type { StackInventory } from "./inventory.ts";
import type { StackName } from "./stacks.ts";

type ResourceInventory = StackInventory["resources"][string];

const { accountId, budget, mailFrom, origins, otlp, otlpAuthorization, prefix } =
  verificationSettings;

const sampling = { enabled: true, headSamplingRate: 0.5 };

const traceDestination = `${prefix}-traces`;

const SENDING_SUBDOMAIN = "Cloudflare.Email.SendingSubdomain";

const sharedWorker = {
  compatibility: {
    date: workerCompatibility.date,
    flags: [...workerCompatibility.flags],
  },
  isExternal: true,
  observability: {
    ...sampling,
    logs: { ...sampling, invocationLogs: false },
    traces: { ...sampling, destinations: [traceDestination], persist: true },
  },
  workersDev: { enabled: false, previewsEnabled: false },
};

const isApplication = Schema.is(Schema.Literals(applications));

function plainText(name: string, value: number | string): string {
  return `${name}:plain_text:text=${value}`;
}

function zoneSetting(settingId: string, value: unknown): ResourceInventory {
  return {
    adopt: false,
    bindings: [],
    declared: { settingId, value, zoneId: verificationSettings.zoneId },
    removalPolicy: "destroy",
    type: "Cloudflare.Zone.Setting",
  };
}

function tokenValue(name: string, resource: string): string {
  return `${name}:deferred:${stackName("tokens")}.${resource}.value`;
}

function applicationResource(app: Application, release: string): ResourceInventory {
  const flagshipBindings = [
    plainText(appEnvKey.flagshipAccountId, accountId),
    `FLAGS:flagship:appId=${stackName("flagship")}.App.appId`,
    ...(app === APPLICATION.wiki
      ? [
          tokenValue(appEnvKey.flagshipApiToken, "FlagshipWrite"),
          `${appEnvKey.flagshipAppId}:deferred:${stackName("flagship")}.App.appId`,
        ]
      : []),
  ];
  return {
    adopt: false,
    bindings: [
      plainText(appEnvKey.appOrigin, origins[app]),
      plainText(appEnvKey.appRelease, release),
      `${appEnvKey.authSecret}:secret_text:text=$${deploymentKey.authSecret}`,
      `DB:d1:databaseId=${stackName("database")}.Database.databaseId`,
      `EMAIL:send_email:allowedSenderAddresses=${mailFrom}`,
      plainText(appEnvKey.emailFrom, mailFrom),
      ...flagshipBindings,
      plainText(appEnvKey.opsEmail, budget.recipients[0] ?? mailFrom),
      `${appEnvKey.otlpAuthorization}:secret_text:text=$${deploymentKey.otlpAuthorization}`,
      plainText(appEnvKey.otlpEnabled, String(otlp.enabled)),
      plainText(appEnvKey.otlpEndpoint, otlp.endpoint),
      ...(grants(app, "ai") ? ["AI:ai"] : []),
    ].toSorted(),
    declared: {
      ...sharedWorker,
      assets: {
        directory: `infra/cloudflare/.artifacts/${app}/<digest>/client`,
        runWorkerFirst: true,
      },
      bundle: false,
      domain: { name: new URL(origins[app]).hostname, zoneId: verificationSettings.zoneId },
      main: `infra/cloudflare/.artifacts/${app}/<digest>/server/index.js`,
      name: `${prefix}-${app}`,
      rules: [{ globs: ["**/*.js", "**/*.mjs", "**/*.txt", "**/*.wasm", "**/*.map"] }],
    },
    removalPolicy: "destroy",
    type: "Cloudflare.Worker",
  };
}

function monitorResource(options: {
  readonly artifact: string;
  readonly className: string;
  readonly cron: string;
  readonly name: string;
  readonly variables: readonly string[];
}): ResourceInventory {
  return {
    adopt: false,
    bindings: [
      plainText("ALERT_FROM", mailFrom),
      plainText("ALERT_TO", budget.recipients.join(",")),
      `EMAIL:send_email:allowedDestinationAddresses=${[...budget.recipients].toSorted().join(",")}:allowedSenderAddresses=${mailFrom}`,
      `MONITOR:durable_object_namespace:className=${options.className}`,
      ...options.variables,
    ].toSorted(),
    declared: {
      ...sharedWorker,
      bundle: false,
      crons: [options.cron],
      main: options.artifact,
      name: `${prefix}-${options.name}`,
    },
    removalPolicy: "destroy",
    type: "Cloudflare.Worker",
  };
}

function accountToken(slug: string, permission: string): ResourceInventory {
  return {
    adopt: false,
    bindings: [],
    declared: {
      accountId,
      name: `${prefix}-${slug}`,
      policies: [
        {
          effect: "allow",
          permissionGroups: [permission],
          resources: { [`com.cloudflare.api.account.${accountId}`]: "*" },
        },
      ],
    },
    removalPolicy: "destroy",
    type: "Cloudflare.ApiToken.AccountApiToken",
  };
}

function declaredStack(
  stack: StackName,
  resources: Readonly<Record<string, ResourceInventory>>,
): StackInventory {
  return {
    dependencies: stackReferences[stack].map((reference) => stackName(reference)).toSorted(),
    name: stackName(stack),
    resources,
  };
}

const applicationStack = Effect.fn("applicationStack")(function* applicationStack(
  app: Application,
) {
  const artifacts = yield* loadArtifacts(repositoryRoot, app);
  return declaredStack(app, { Worker: applicationResource(app, artifacts.release) });
});

const staticExpected: Readonly<Record<Exclude<StackName, Application>, StackInventory>> = {
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
        plainText(budgetMonitorEnv.fixedCostUsd, budget.fixedCostUsd),
        plainText(budgetMonitorEnv.jpyPerUsd, budget.jpyPerUsd),
        plainText(budgetMonitorEnv.reserveUsd, budget.reserveUsd),
      ],
    }),
  }),
  database: declaredStack("database", {
    Database: {
      adopt: false,
      bindings: [],
      declared: { name: `${prefix}-db` },
      removalPolicy: "retain",
      type: "Cloudflare.D1Database",
    },
  }),
  email: declaredStack("email", {
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
        enabled: otlp.enabled,
        headers: { authorization: otlpAuthorization },
        logpushDataset: "opentelemetry-traces",
        name: traceDestination,
        url: `${otlp.endpoint}/v1/traces`,
      },
      removalPolicy: "destroy",
      type: "Cloudflare.Workers.ObservabilityDestination",
    },
  }),
  tokens: declaredStack("tokens", {
    BillingRead: accountToken("billing-read", "Billing Read"),
    FlagshipWrite: accountToken("flagship-write", "Flagship Write"),
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
    !isDeepStrictEqual(onboarding, [onboardingStack]) ||
    !isDeepStrictEqual(senders.toSorted(), [...sendingStacks].toSorted());
  if (differs) {
    yield* Console.error(
      JSON.stringify({ event: "stacks.roles_differ", onboarding, senders, violations }),
    );
  }
  return differs;
});

const verifyStack = Effect.fn("verifyStack")(function* verifyStack(stack: StackName) {
  const inventory = yield* compileStack(stack);
  const expected = yield* expectedStack(stack);
  const matches = isDeepStrictEqual(inventory, expected);
  if (!matches) {
    yield* Console.error(
      JSON.stringify({ actual: inventory, event: "stacks.differs", expected, stack }),
    );
  }
  return { matches, onboards: onboards(inventory), sends: bindsSendEmail(inventory) } as const;
});

runCli(
  Effect.gen(function* program() {
    const verified = yield* Effect.all(stackNames.map((stack) => verifyStack(stack)));
    const differs = yield* rolesDiffer(verified);
    if (differs || verified.some((entry) => !entry.matches)) {
      yield* markFailed;
      return;
    }
    yield* Console.log(JSON.stringify({ event: "stacks.verified", stacks: stackNames.length }));
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
  (cause) => ({ detail: describeCause(Cause.squash(cause)), event: "stacks.invalid" }),
);
