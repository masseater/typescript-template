import { httpStatus } from "@repo/observability/http-status";
import { Effect } from "effect";

import { monitorCheckUrl } from "./binding.ts";
import { Monitor, type Alert, type MonitorBindings, type Notify } from "./monitor-base.ts";

import type { DurableObjectNamespace, DurableObjectState } from "@cloudflare/workers-types";

type MonitorHandler = {
  readonly fetch: () => Response;
  readonly scheduled: (
    scheduledController: unknown,
    env: Readonly<{
      MONITOR: Readonly<Pick<DurableObjectNamespace, "get" | "idFromName">>;
    }>,
  ) => Promise<void>;
};

const monitorHandler = (monitorEvent: string): MonitorHandler => ({
  fetch: () => new Response("Not found", { status: httpStatus.notFound }),
  scheduled: (_scheduledController, env) => {
    const stub = env.MONITOR.get(env.MONITOR.idFromName(monitorEvent));
    return Effect.runPromise(
      Effect.gen(function* scheduledCheck() {
        const checked = yield* Effect.promise(() =>
          stub.fetch(monitorCheckUrl, { method: "POST" }),
        );
        if (!checked.ok) {
          return yield* Effect.die(`${monitorEvent}_schedule_failed`);
        }
      }),
    );
  },
});

const monitorWorker = <Bindings extends MonitorBindings>(definition: {
  readonly check: (
    scope: { readonly ctx: DurableObjectState; readonly env: Bindings },
    notify: Notify,
  ) => Effect.Effect<object, unknown>;
  readonly event: string;
  readonly failure: Alert;
}): {
  readonly Worker: new (
    durableState: DurableObjectState,
    env: Bindings,
  ) => {
    fetch(): Promise<Response>;
  };
  readonly handler: MonitorHandler;
} => {
  const { check, event: monitorEvent, failure } = definition;
  class Worker extends Monitor<Bindings> {
    protected readonly monitorEvent = monitorEvent;
    protected readonly failure = failure;

    protected check(notify: Notify): Effect.Effect<object, unknown> {
      return check({ ctx: this.durableState, env: this.env }, notify);
    }
  }
  return { Worker, handler: monitorHandler(monitorEvent) };
};

export { monitorWorker };
