import { causeRecord, runCli } from "@repo/cli";
import { Console, Effect } from "effect";

import { fetchUsage } from "./billing.ts";
import { parseBudgetConfig } from "./config.ts";
import { evaluateBudget } from "./decision.ts";

runCli(
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
  }),
  (cause) => causeRecord("budget.inspect_failed", cause),
);
