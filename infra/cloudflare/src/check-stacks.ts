#!/usr/bin/env node
// oxlint-disable-next-line import/no-nodejs-modules
import { isDeepStrictEqual } from "node:util";

import { applications, grants } from "@repo/config";
import { markFailed, reportFailed, runCli } from "@repo/config/cli";
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
  compatibility: { date: "2026-09-16", flags: ["nodejs_compat"] },
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
  return {
    adopt: false,
    bindings: [
      plainText("APP_ORIGIN", origins[app]),
      plainText("APP_RELEASE", release),
      "AUTH_SECRET:secret_text:text=$TEMPLATE_AUTH_SECRET",
      `DB:d1:databaseId=${stackName("database")}.Database.databaseId`,
      `EMAIL:send_email:allowedSenderAddresses=${mailFrom}`,
      plainText("EMAIL_FROM", mailFrom),
      plainText("OPS_EMAIL", budget.recipients[0] ?? mailFrom),
      "OTLP_AUTHORIZATION:secret_text:text=$TEMPLATE_OTLP_AUTHORIZATION",
      plainText("OTLP_ENABLED", String(otlp.enabled)),
      plainText("OTLP_ENDPOINT", otlp.endpoint),
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
      className: "BudgetMonitor",
      cron: "17 */6 * * *",
      name: "budget",
      variables: [
        tokenValue("BILLING_READ_TOKEN", "BillingRead"),
        plainText("BUDGET_JPY", budget.budgetJpy),
        plainText("CLOUDFLARE_ACCOUNT_ID", accountId),
        plainText("FIXED_COST_USD", budget.fixedCostUsd),
        plainText("JPY_PER_USD", budget.jpyPerUsd),
        plainText("RESERVE_USD", budget.reserveUsd),
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
      className: "ErrorMonitor",
      cron: "*/5 * * * *",
      name: "errors",
      variables: [
        plainText("CLOUDFLARE_ACCOUNT_ID", accountId),
        tokenValue("OBSERVABILITY_TOKEN", "ObservabilityQuery"),
      ],
    }),
  }),
  "health-monitor": declaredStack("health-monitor", {
    Worker: monitorResource({
      artifact: "infra/health-monitor/dist/index.js",
      className: "HealthMonitor",
      cron: "37 * * * *",
      name: "health",
      variables: [
        plainText("SERVICE_ADMIN_ORIGIN", origins["service-admin"]),
        plainText("SERVICE_MEMBER_ORIGIN", origins["service-member"]),
        plainText("INTERNAL_DASHBOARD_ORIGIN", origins["internal-dashboard"]),
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
    ObservabilityQuery: accountToken("observability-query", "Workers Observability Write"),
  }),
  zone: declaredStack("zone", {
    AlwaysUseHttps: zoneSetting("always_use_https", "on"),
    SecurityHeader: zoneSetting("security_header", hstsSetting),
  }),
};

const expectedStack = Effect.fn("expectedStack")(function* expectedStack(stack: StackName) {
  return isApplication(stack) ? yield* applicationStack(stack) : staticExpected[stack];
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
