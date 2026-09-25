import { httpStatus } from "@repo/config";
import { Effect } from "effect";

import { monitorCheckUrl } from "./binding.ts";
import { runMonitor, type Alert, type MonitorBindings, type Notify } from "./monitor-base.ts";

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
  class Worker {
    private readonly durableState: DurableObjectState;
    private readonly env: Bindings;

    public constructor(durableState: DurableObjectState, env: Bindings) {
      this.durableState = durableState;
      this.env = env;
    }

    public fetch(): Promise<Response> {
      const { durableState, env } = this;
      return runMonitor({
        check: (notify) => check({ ctx: durableState, env }, notify),
        durableState,
        env,
        failure,
        monitorEvent,
      });
    }
  }
  return { Worker, handler: monitorHandler(monitorEvent) };
};

export { monitorWorker };
export type { MonitorHandler };
