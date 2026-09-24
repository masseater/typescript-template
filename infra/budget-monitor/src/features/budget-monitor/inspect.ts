#!/usr/bin/env node
import { causeRecord, runCli } from "@repo/cli";
import { Console, Effect, Schema } from "effect";

import { parseBudgetConfig } from "./config.ts";
import { measureBudget } from "./measure.ts";

runCli(
  Effect.gen(function* program() {
    const config = yield* parseBudgetConfig(process.env);
    const decision = yield* measureBudget(config);
    yield* Console.log(
      yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
        event: "budget.inspected",
        ...decision,
      }).pipe(Effect.orDie),
    );
  }),
  (cause) => causeRecord("budget.inspect_failed", { cause }),
);
