import { httpStatus } from "@repo/observability/http-status";
import { Effect } from "effect";

import { monitorCheckUrl } from "./binding.ts";
import { Monitor, type Alert, type MonitorBindings, type Notify } from "./monitor-base.ts";

const monitorHandler = (
  monitorEvent: string,
): {
  readonly fetch: () => Response;
  readonly scheduled: (
    scheduledController: unknown,
    env: Readonly<{
      MONITOR: Readonly<Pick<DurableObjectNamespace, "get" | "idFromName">>;
    }>,
  ) => Promise<void>;
} => ({
  fetch: () => new Response("Not found", { status: httpStatus.notFound }),
  scheduled: async (_scheduledController, env) => {
    const stub = env.MONITOR.get(env.MONITOR.idFromName(monitorEvent));
    const checked = await Effect.runPromise(
      Effect.promise(async () => stub.fetch(monitorCheckUrl, { method: "POST" })),
    );
    if (!checked.ok) {
      await Effect.runPromise(Effect.die(`${monitorEvent}_schedule_failed`));
    }
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
  readonly Worker: new (durableState: DurableObjectState, env: Bindings) => {
    fetch(): Promise<Response>;
  };
  readonly handler: ReturnType<typeof monitorHandler>;
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
