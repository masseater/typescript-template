#!/usr/bin/env node
import { causeRecord, runCli } from "@repo/cli";
import { Console, Effect } from "effect";

import { billableUsageEndpoint, fetchUsage } from "./billing.ts";
import { parseBudgetConfig } from "./config.ts";
import { evaluateBudget } from "./decision.ts";

runCli(
  Effect.gen(function* program() {
    // oxlint-disable-next-line node/no-process-env -- this statement reads or writes process.env at the Node process boundary
    const config = yield* parseBudgetConfig(process.env);
    const usage = yield* fetchUsage({
      accountId: config.CLOUDFLARE_ACCOUNT_ID,
      observedAt: new Date(),
      token: config.BILLING_READ_TOKEN,
      usageEndpoint: billableUsageEndpoint(config.CLOUDFLARE_ACCOUNT_ID),
    });
    const decision = yield* evaluateBudget(usage, config);
    yield* Console.log(JSON.stringify({ event: "budget.inspected", ...decision }));
  }),
  (cause) => causeRecord("budget.inspect_failed", { cause }),
);
