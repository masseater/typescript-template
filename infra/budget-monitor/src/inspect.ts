import { NodeRuntime } from "@effect/platform-node";
import { Console, Effect } from "effect";

import { reportFailed } from "@repo/config/cli";

import { fetchUsage } from "./billing.ts";
import { parseBudgetConfig } from "./config.ts";
import { evaluateBudget } from "./decision.ts";

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
    yield* Console.log(JSON.stringify({ event: "budget.inspected", ...decision }));
  }).pipe(Effect.catchCause(() => reportFailed({ event: "budget.inspect_failed" }))),
  { disableErrorReporting: true },
);
