import { applyVerificationEnvironment, compileStack } from "./inventory.ts";
import { Effect } from "effect";
import { NodeRuntime } from "@effect/platform-node";
import type { StackName } from "./stacks.ts";
import { stackNames } from "./stacks.ts";

const appBindings = ["APP_ORIGIN", "APP_RELEASE", "AUTH_SECRET", "DB", "EMAIL", "EMAIL_FROM"];
const monitorBindings = ["ALERT_FROM", "ALERT_TO", "EMAIL", "MONITOR"];

const expected: Readonly<
  Record<
    StackName,
    {
      readonly bindings: Readonly<Record<string, readonly string[]>>;
      readonly resources: Readonly<Record<string, string>>;
    }
  >
> = {
  admin: {
    bindings: { Worker: appBindings },
    resources: { Worker: "Cloudflare.Worker" },
  },
  "budget-monitor": {
    bindings: {
      Worker: [
        ...monitorBindings,
        "BILLING_READ_TOKEN",
        "BUDGET_JPY",
        "CLOUDFLARE_ACCOUNT_ID",
        "FIXED_COST_USD",
        "JPY_PER_USD",
        "RESERVE_USD",
      ].toSorted(),
    },
    resources: { Worker: "Cloudflare.Worker" },
  },
  database: { bindings: {}, resources: { Database: "Cloudflare.D1Database" } },
  "error-monitor": {
    bindings: {
      Worker: [...monitorBindings, "CLOUDFLARE_ACCOUNT_ID", "OBSERVABILITY_TOKEN"].toSorted(),
    },
    resources: { Worker: "Cloudflare.Worker" },
  },
  "health-monitor": {
    bindings: {
      Worker: [...monitorBindings, "ADMIN_ORIGIN", "USER_ORIGIN", "WIKI_ORIGIN"].toSorted(),
    },
    resources: { Worker: "Cloudflare.Worker" },
  },
  tokens: {
    bindings: {},
    resources: {
      BillingRead: "Cloudflare.ApiToken.AccountApiToken",
      ObservabilityQuery: "Cloudflare.ApiToken.AccountApiToken",
    },
  },
  user: { bindings: { Worker: appBindings }, resources: { Worker: "Cloudflare.Worker" } },
  wiki: {
    bindings: { Worker: ["AI", ...appBindings].toSorted() },
    resources: { Worker: "Cloudflare.Worker" },
  },
};

applyVerificationEnvironment();

const verifyStack = Effect.fn("verifyStack")(function* verifyStack(stack: StackName) {
  const inventory = yield* compileStack(stack);
  const declared = JSON.stringify({
    bindings: inventory.bindings,
    resources: inventory.resources,
  });
  const wanted = JSON.stringify(expected[stack]);
  // oxlint-disable-next-line no-console
  console.log(
    JSON.stringify({
      bindings: inventory.bindings,
      event: "stacks.verified",
      matchesExpectation: declared === wanted,
      name: inventory.name,
      resources: inventory.resources,
    }),
  );
  return declared === wanted;
});

NodeRuntime.runMain(
  Effect.gen(function* program() {
    const verified = yield* Effect.all(stackNames.map((stack) => verifyStack(stack)));
    if (verified.includes(false)) {
      process.exitCode = 1;
    }
  }).pipe(
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types
    Effect.catchTag("InventoryFailure", (failure) =>
      Effect.sync(() => {
        // oxlint-disable-next-line no-console
        console.error(
          JSON.stringify({ code: failure.code, event: "stacks.invalid", stack: failure.stack }),
        );
        process.exitCode = 1;
      }),
    ),
    Effect.catchCause(() =>
      Effect.sync(() => {
        // oxlint-disable-next-line no-console
        console.error(JSON.stringify({ event: "stacks.invalid" }));
        process.exitCode = 1;
      }),
    ),
  ),
  { disableErrorReporting: true },
);
