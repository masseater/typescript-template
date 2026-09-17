import { Effect } from "effect";
import { NodeRuntime } from "@effect/platform-node";
import { evaluateBudget } from "./decision.ts";
import { fetchUsage } from "./billing.ts";
import { parseBudgetConfig } from "./config.ts";

NodeRuntime.runMain(
  Effect.gen(function* program() {
    // oxlint-disable-next-line node/no-process-env
    const config = yield* parseBudgetConfig(process.env);
    const usage = yield* fetchUsage(
      config.CLOUDFLARE_ACCOUNT_ID,
      config.BILLING_READ_TOKEN,
      new Date(),
    );
    const decision = yield* evaluateBudget(usage, config);
    // oxlint-disable-next-line no-console
    console.log(JSON.stringify({ event: "budget.inspected", ...decision }));
  }).pipe(
    Effect.catchCause(() =>
      Effect.sync(() => {
        // oxlint-disable-next-line no-console
        console.error(JSON.stringify({ event: "budget.inspect_failed" }));
        process.exitCode = 1;
      }),
    ),
  ),
  { disableErrorReporting: true },
);
