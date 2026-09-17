import { DurableObject } from "cloudflare:workers";
import { Effect, Exit } from "effect";
import { fetchUsage } from "./billing.ts";
import { parseBudgetConfig } from "./config.ts";
import type { BudgetConfig } from "./config.ts";
import { evaluateBudget, shouldNotify } from "./decision.ts";

interface Bindings {
  MONITOR: DurableObjectNamespace;
  EMAIL: SendEmail;
  CLOUDFLARE_ACCOUNT_ID: string;
  BILLING_READ_TOKEN: string;
  BUDGET_JPY: string;
  JPY_PER_USD: string;
  FIXED_COST_USD: string;
  RESERVE_USD: string;
  ALERT_FROM: string;
  ALERT_TO: string;
}

const monitor = (storage: DurableObjectStorage, email: SendEmail) => {
  const get = <T>(key: string) => Effect.promise(() => storage.get<T>(key));
  const put = (key: string, value: unknown) => Effect.promise(() => storage.put(key, value));
  const send = (config: BudgetConfig, subject: string, text: string) =>
    Effect.promise(() =>
      email.send({ from: config.ALERT_FROM, to: [...config.ALERT_TO], subject, text }),
    );

  const check = Effect.fn("BudgetMonitor.check")(function* (config: BudgetConfig) {
    const snapshot = yield* fetchUsage(
      config.CLOUDFLARE_ACCOUNT_ID,
      config.BILLING_READ_TOKEN,
      new Date(),
    );
    const decision = yield* evaluateBudget(snapshot, config);
    const previous = yield* get<{ period: string; keys: string[] }>("notifications");
    const keys = previous?.period === decision.periodStart ? previous.keys : [];
    if (shouldNotify(decision, keys)) {
      yield* send(
        config,
        `Cloudflare budget: ${decision.level}% threshold`,
        JSON.stringify(decision),
      );
      yield* put("notifications", {
        period: decision.periodStart,
        keys: [...keys, decision.notificationKey],
      });
    }
    yield* put("health", { ok: true, at: new Date().toISOString(), decision });
    yield* Effect.promise(() => storage.delete("failureNotifiedDay"));
    return decision;
  });

  const recordFailure = Effect.fn("BudgetMonitor.recordFailure")(function* (config: BudgetConfig) {
    yield* put("health", { ok: false, at: new Date().toISOString() });
    const day = new Date().toISOString().slice(0, 10);
    if ((yield* get<string>("failureNotifiedDay")) !== day) {
      yield* send(
        config,
        "Cloudflare budget monitoring failed",
        "Billing data or notification delivery could not be verified. Inspect budget.check_failed logs. Costs must not be treated as zero.",
      );
      yield* put("failureNotifiedDay", day);
    }
  });

  return Effect.fn("BudgetMonitor.run")(function* (env: unknown) {
    const config = yield* parseBudgetConfig(env);
    const started = Date.now();
    const outcome = yield* Effect.exit(check(config));
    if (Exit.isSuccess(outcome)) {
      console.log(
        JSON.stringify({
          event: "budget.checked",
          ...outcome.value,
          durationMs: Date.now() - started,
        }),
      );
      return Response.json({ ok: true, decision: outcome.value });
    }
    console.error(
      JSON.stringify({ event: "budget.check_failed", durationMs: Date.now() - started }),
    );
    yield* recordFailure(config);
    return yield* Effect.die("budget_check_failed");
  });
};

export class BudgetMonitor extends DurableObject<Bindings> {
  override async fetch(): Promise<Response> {
    const run = monitor(this.ctx.storage, this.env.EMAIL);
    return this.ctx.blockConcurrencyWhile(() => Effect.runPromise(run(this.env)));
  }
}

export default {
  fetch(): Response {
    return new Response("Not found", { status: 404 });
  },
  scheduled(_event: ScheduledController, env: Bindings): Promise<void> {
    return Effect.runPromise(
      Effect.gen(function* () {
        const stub = env.MONITOR.get(env.MONITOR.idFromName("account-budget"));
        const result = yield* Effect.promise(() =>
          stub.fetch("https://budget.internal/check", { method: "POST" }),
        );
        if (!result.ok) return yield* Effect.die("budget_schedule_failed");
      }),
    );
  },
} satisfies ExportedHandler<Bindings>;
