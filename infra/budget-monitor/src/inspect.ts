#!/usr/bin/env node
import { env as processEnvironment } from "node:process";

import { causeRecord, runCli } from "@repo/cli";
import { Clock, Console, Effect, Schema } from "effect";

import { fetchUsage } from "./billing.ts";
import { parseBudgetConfig } from "./config.ts";
import { evaluateBudget } from "./decision.ts";

runCli(
  Effect.gen(function* program() {
    const config = yield* parseBudgetConfig(processEnvironment);
    const usage = yield* fetchUsage({
      accountId: config.CLOUDFLARE_ACCOUNT_ID,
      observedAt: yield* Clock.currentTimeMillis,
      token: config.BILLING_READ_TOKEN,
    });
    const decision = yield* evaluateBudget(usage, config);
    yield* Console.log(
      yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
        event: "budget.inspected",
        ...decision,
      }).pipe(Effect.orDie),
    );
  }),
  (cause) => causeRecord("budget.inspect_failed", { cause }),
);
