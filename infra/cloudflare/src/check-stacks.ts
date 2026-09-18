import { Cause, Console, Effect, Schema } from "effect";
import { applications, grants } from "@repo/config";
import { applyVerificationEnvironment, compileStack, describeCause } from "./inventory.ts";
import { loadArtifacts, repositoryRoot } from "./artifacts.ts";
import { stackDependencies, stackName, stackNames } from "./stacks.ts";
import type { Application } from "@repo/config";
import { NodeRuntime } from "@effect/platform-node";
import type { StackInventory } from "./inventory.ts";
import type { StackName } from "./stacks.ts";
// oxlint-disable-next-line import/no-nodejs-modules
import { isDeepStrictEqual } from "node:util";
import { markFailed } from "./secrets.ts";
import { verificationSettings } from "./verification-fixture.ts";

type ResourceInventory = StackInventory["resources"][string];

const { accountId, budget, mailFrom, origins, otlp, otlpAuthorization, prefix } =
  verificationSettings;

const sampling = { enabled: true, headSamplingRate: 0.5 };

const traceDestination = `${prefix}-traces`;

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
    dependencies: stackDependencies[stack].map((dependency) => stackName(dependency)).toSorted(),
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
        plainText("ADMIN_ORIGIN", origins.admin),
        plainText("USER_ORIGIN", origins.user),
        plainText("WIKI_ORIGIN", origins.wiki),
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
};

const expectedStack = Effect.fn("expectedStack")(function* expectedStack(stack: StackName) {
  return isApplication(stack) ? yield* applicationStack(stack) : staticExpected[stack];
});

applyVerificationEnvironment();

const verifyStack = Effect.fn("verifyStack")(function* verifyStack(stack: StackName) {
  const inventory = yield* compileStack(stack);
  const expected = yield* expectedStack(stack);
  const matches = isDeepStrictEqual(inventory, expected);
  if (!matches) {
    yield* Console.error(
      JSON.stringify({ actual: inventory, event: "stacks.differs", expected, stack }),
    );
  }
  return matches;
});

NodeRuntime.runMain(
  Effect.gen(function* program() {
    const verified = yield* Effect.all(stackNames.map((stack) => verifyStack(stack)));
    if (verified.includes(false)) {
      yield* markFailed;
      return;
    }
    yield* Console.log(JSON.stringify({ event: "stacks.verified", stacks: stackNames.length }));
  }).pipe(
    Effect.catchTag("InventoryFailure", (failure) =>
      Console.error(
        JSON.stringify({
          code: failure.code,
          detail: failure.detail,
          event: "stacks.invalid",
          stack: failure.stack,
        }),
      ).pipe(Effect.andThen(markFailed)),
    ),
    Effect.catchCause((cause) => {
      const detail = describeCause(Cause.squash(cause));
      return Console.error(JSON.stringify({ detail, event: "stacks.invalid" })).pipe(
        Effect.andThen(markFailed),
      );
    }),
  ),
  { disableErrorReporting: true },
);
