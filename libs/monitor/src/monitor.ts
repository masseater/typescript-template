import { httpStatus } from "@repo/observability";
import { DurableObject } from "cloudflare:workers";
import { Console, Effect, Exit, Schema } from "effect";

import { AlertEnvironment } from "./alert-environment.ts";
import { MonitorFailure } from "./failure.ts";

const ISO_DATE_LENGTH = 10;
const failureNotifiedDayKey = "failureNotifiedDay";

type Alert = {
  readonly subject: string;
  readonly text: string;
};

export type Notify = (alert: Alert) => Effect.Effect<void>;

export type MonitorBindings = {
  readonly ALERT_FROM: string;
  readonly ALERT_TO: string;
  readonly EMAIL: SendEmail;
};

export abstract class Monitor<Bindings extends MonitorBindings> extends DurableObject<Bindings> {
  protected abstract readonly eventName: string;
  protected abstract readonly failure: Alert;

  public async runCheck(): Promise<Response> {
    return this.ctx.blockConcurrencyWhile(async () => Effect.runPromise(this.run()));
  }

  private run(): Effect.Effect<Response, MonitorFailure> {
    return this.notifier().pipe(
      Effect.flatMap((notify) => {
        const started = Date.now();
        return Effect.exit(this.check(notify)).pipe(
          Effect.flatMap((checkExit) =>
            Exit.isSuccess(checkExit)
              ? this.reportSuccess(checkExit.value, started)
              : this.reportFailure(notify, started),
          ),
        );
      }),
    );
  }

  private notifier(): Effect.Effect<Notify, MonitorFailure> {
    const { EMAIL } = this.env;
    return Schema.decodeUnknownEffect(AlertEnvironment)(this.env).pipe(
      Effect.mapError(() => new MonitorFailure({ code: "alert_config_invalid" })),
      Effect.map(
        (recipients): Notify =>
          (alert) =>
            Effect.promise(async () =>
              EMAIL.send({ from: recipients.ALERT_FROM, to: [...recipients.ALERT_TO], ...alert }),
            ),
      ),
    );
  }

  private reportSuccess(checkSummary: object, started: number): Effect.Effect<Response> {
    const { storage } = this.ctx;
    const { eventName } = this;
    return Effect.promise(async () => storage.delete(failureNotifiedDayKey)).pipe(
      Effect.andThen(() =>
        Console.log(
          JSON.stringify({
            event: `${eventName}.checked`,
            ...checkSummary,
            durationMs: Date.now() - started,
          }),
        ),
      ),
      Effect.map(() => Response.json({ ok: true, ...checkSummary })),
    );
  }

  private reportFailure(notify: Notify, started: number): Effect.Effect<Response> {
    const { eventName, failure } = this;
    const { storage } = this.ctx;
    return Effect.gen(function* reportFailure() {
      yield* Console.error(
        JSON.stringify({ durationMs: Date.now() - started, event: `${eventName}.check_failed` }),
      );
      const day = new Date(started).toISOString().slice(0, ISO_DATE_LENGTH);
      const notifiedDay = yield* Effect.promise(async () =>
        storage.get<string>(failureNotifiedDayKey),
      );
      if (notifiedDay !== day) {
        yield* notify(failure);
        yield* Effect.promise(async () => storage.put(failureNotifiedDayKey, day));
      }
      return Response.json({ ok: false }, { status: httpStatus.internalServerError });
    });
  }

  protected abstract check(notify: Notify): Effect.Effect<object, unknown>;
}

export const monitorHandler = (
  eventName: string,
): {
  readonly fetch: () => Response;
  readonly scheduled: (
    controller: unknown,
    env: Readonly<{ MONITOR: DurableObjectNamespace<Monitor<MonitorBindings>> }>,
  ) => Promise<void>;
} => ({
  fetch: () => new Response("Not found", { status: httpStatus.notFound }),
  scheduled: async (_controller, env) => {
    const monitorStub = env.MONITOR.get(env.MONITOR.idFromName(eventName));
    const checkResponse = await monitorStub.runCheck();
    await Effect.runPromise(
      checkResponse.ok ? Effect.void : Effect.fail(new MonitorFailure({ code: "schedule_failed" })),
    );
  },
});
