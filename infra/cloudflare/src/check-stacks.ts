import {
  applyOrderViolations,
  onboardingStack,
  sendingStacks,
  stackDependencies,
  stackName,
  stackNames,
} from "./stacks.ts";
import { applyVerificationEnvironment, bindsSendEmail, compileStack } from "./inventory.ts";
import {
  sendingDomain,
  workerCompatibilityOptions,
  workerObservability,
  workerSubdomain,
} from "./config.ts";
import type { Application } from "@template/config";
import { Effect } from "effect";
import { FAILED_EXIT_CODE } from "./secrets.ts";
import { NodeRuntime } from "@effect/platform-node";
import type { StackInventory } from "./inventory.ts";
import type { StackName } from "./stacks.ts";
import { databaseName } from "./database-lookup.ts";
import { grants } from "@template/config";
import { verificationSettings } from "./verification-fixture.ts";
import { workerModuleGlobs } from "./artifacts.ts";

const { accountId, origins, prefix } = verificationSettings;

const SENDING_SUBDOMAIN = "Cloudflare.Email.SendingSubdomain";

const sharedWorker = {
  compatibility: workerCompatibilityOptions,
  observability: workerObservability(verificationSettings.observabilitySampling),
  workersDev: workerSubdomain,
};

function applicationResource(app: Application): unknown {
  return {
    adopt: false,
    bindings: [
      "APP_ORIGIN:plain_text",
      "APP_RELEASE:plain_text",
      "AUTH_SECRET:secret_text",
      "DB:d1",
      `EMAIL:send_email:${verificationSettings.mailFrom}`,
      "EMAIL_FROM:plain_text",
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
      rules: [{ globs: workerModuleGlobs }],
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
}): unknown {
  return {
    adopt: false,
    bindings: [
      "ALERT_FROM:plain_text",
      "ALERT_TO:plain_text",
      `EMAIL:send_email:${[...verificationSettings.budget.recipients].toSorted().join(",")}:${verificationSettings.mailFrom}`,
      `MONITOR:durable_object_namespace:${options.className}`,
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

function accountToken(slug: string, permission: string): unknown {
  return {
    adopt: false,
    bindings: [],
    declared: {
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

function declaredStack(stack: StackName, resources: Readonly<Record<string, unknown>>): unknown {
  return {
    dependencies: stackDependencies[stack].map((dependency) => stackName(dependency)).toSorted(),
    name: stackName(stack),
    resources,
  };
}

const expected: Readonly<Record<StackName, unknown>> = {
  admin: declaredStack("admin", { Worker: applicationResource("admin") }),
  "budget-monitor": declaredStack("budget-monitor", {
    Worker: monitorResource({
      artifact: "infra/budget-monitor/dist/index.js",
      className: "BudgetMonitor",
      cron: "17 */6 * * *",
      name: "budget",
      variables: [
        "BILLING_READ_TOKEN:deferred",
        "BUDGET_JPY:plain_text",
        "CLOUDFLARE_ACCOUNT_ID:plain_text",
        "FIXED_COST_USD:plain_text",
        "JPY_PER_USD:plain_text",
        "RESERVE_USD:plain_text",
      ],
    }),
  }),
  database: declaredStack("database", {
    Database: {
      adopt: false,
      bindings: [],
      declared: { name: databaseName(prefix) },
      removalPolicy: "retain",
      type: "Cloudflare.D1Database",
    },
  }),
  email: declaredStack("email", {
    Sending: {
      adopt: false,
      bindings: [],
      declared: {
        name: sendingDomain(verificationSettings.mailFrom),
        zoneId: verificationSettings.zoneId,
      },
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
      variables: ["CLOUDFLARE_ACCOUNT_ID:plain_text", "OBSERVABILITY_TOKEN:deferred"],
    }),
  }),
  "health-monitor": declaredStack("health-monitor", {
    Worker: monitorResource({
      artifact: "infra/health-monitor/dist/index.js",
      className: "HealthMonitor",
      cron: "37 * * * *",
      name: "health",
      variables: ["ADMIN_ORIGIN:plain_text", "USER_ORIGIN:plain_text", "WIKI_ORIGIN:plain_text"],
    }),
  }),
  tokens: declaredStack("tokens", {
    BillingRead: accountToken("billing-read", "Billing Read"),
    ObservabilityQuery: accountToken("observability-query", "Workers Observability Write"),
  }),
  user: declaredStack("user", { Worker: applicationResource("user") }),
  wiki: declaredStack("wiki", { Worker: applicationResource("wiki") }),
};

applyVerificationEnvironment();

function byKey(left: readonly [string, unknown], right: readonly [string, unknown]): number {
  return left[0].localeCompare(right[0]);
}

function canonical(value: unknown): string {
  return JSON.stringify(value, (_key: string, nested: unknown) =>
    typeof nested === "object" && nested !== null && !Array.isArray(nested)
      ? Object.fromEntries(Object.entries(nested).toSorted(byKey))
      : nested,
  );
}

function declaredMatches(inventory: StackInventory, stack: StackName): boolean {
  return canonical(inventory) === canonical(expected[stack]);
}

function onboards(inventory: StackInventory): boolean {
  return Object.values(inventory.resources).some((resource) => resource.type === SENDING_SUBDOMAIN);
}

function rolesDiffer(
  verified: readonly Readonly<{ onboards: boolean; sends: boolean }>[],
): boolean {
  const onboarding = stackNames.filter((_stack, index) => verified[index]?.onboards === true);
  const senders = stackNames.filter((_stack, index) => verified[index]?.sends === true);
  const violations = applyOrderViolations(stackNames);
  const differs =
    violations.length > 0 ||
    canonical(onboarding) !== canonical([onboardingStack]) ||
    canonical(senders.toSorted()) !== canonical([...sendingStacks].toSorted());
  if (differs) {
    // oxlint-disable-next-line no-console
    console.error(
      JSON.stringify({ event: "stacks.roles_differ", onboarding, senders, violations }),
    );
  }
  return differs;
}

const verifyStack = Effect.fn("verifyStack")(function* verifyStack(stack: StackName) {
  const inventory = yield* compileStack(stack);
  const matches = declaredMatches(inventory, stack);
  if (!matches) {
    // oxlint-disable-next-line no-console
    console.error(
      JSON.stringify({
        actual: inventory,
        event: "stacks.differs",
        expected: expected[stack],
        stack,
      }),
    );
  }
  return { matches, onboards: onboards(inventory), sends: bindsSendEmail(inventory) } as const;
});

NodeRuntime.runMain(
  Effect.gen(function* program() {
    const verified = yield* Effect.all(stackNames.map((stack) => verifyStack(stack)));
    if (rolesDiffer(verified) || verified.some((entry) => !entry.matches)) {
      process.exitCode = FAILED_EXIT_CODE;
      return;
    }
    // oxlint-disable-next-line no-console
    console.log(JSON.stringify({ event: "stacks.verified", stacks: stackNames.length }));
  }).pipe(
    Effect.catchTag("InventoryFailure", (failure) =>
      Effect.sync(() => {
        // oxlint-disable-next-line no-console
        console.error(
          JSON.stringify({ code: failure.code, event: "stacks.invalid", stack: failure.stack }),
        );
        process.exitCode = FAILED_EXIT_CODE;
      }),
    ),
    Effect.catchCause(() =>
      Effect.sync(() => {
        // oxlint-disable-next-line no-console
        console.error(JSON.stringify({ event: "stacks.invalid" }));
        process.exitCode = FAILED_EXIT_CODE;
      }),
    ),
  ),
  { disableErrorReporting: true },
);
