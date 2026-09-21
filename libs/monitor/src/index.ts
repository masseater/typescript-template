import { Email } from "@repo/config";
import { httpStatus } from "@repo/observability/http-status";
import { Cause, Console, Effect, Exit, Predicate, Schema, SchemaGetter } from "effect";

import { monitorBinding } from "./binding.ts";
import { MonitorFailure } from "./failure.ts";

interface Alert {
  readonly subject: string;
  readonly text: string;
}

type Notify = (alert: Alert) => Effect.Effect<void>;

interface MonitorBindings {
  readonly ALERT_FROM: string;
  readonly ALERT_TO: string;
  readonly EMAIL: SendEmail;
  readonly MONITOR: DurableObjectNamespace;
}

interface MonitorHandler {
  readonly fetch: () => Response;
  readonly scheduled: (controller: unknown, env: MonitorSchedule) => Promise<void>;
}

type MonitorSchedule = Readonly<{
  MONITOR: Readonly<Pick<DurableObjectNamespace, "get" | "idFromName">>;
}>;

const maximumAlertRecipients = 10;
const ISO_DATE_LENGTH = 10;

const UNRECOGNIZED_REASON = "unrecognized";
const declaredFailure = Schema.Struct({
  _tag: Schema.String.check(Schema.isPattern(/^[A-Za-z][A-Za-z0-9]{0,63}$/u)),
  code: Schema.String.check(Schema.isPattern(/^[a-z][a-z0-9_]{0,63}$/u)),
});
const isDeclaredFailure = Schema.is(declaredFailure);

function failureReason(cause: Readonly<Cause.Cause<unknown>>): string {
  const error: unknown = Cause.squash(cause);
  if (!isDeclaredFailure(error)) {
    return UNRECOGNIZED_REASON;
  }
  const base = `${error._tag}.${error.code}`;
  if (
    !Predicate.hasProperty(error, "keys") ||
    !Array.isArray(error.keys) ||
    error.keys.length === 0 ||
    !error.keys.every((key) => typeof key === "string")
  ) {
    return base;
  }
  return `${base}:${error.keys.join(",")}`;
}

const Recipients = Schema.Array(Email).check(Schema.isLengthBetween(1, maximumAlertRecipients));
const splitRecipients = SchemaGetter.transform((value: string) => value.split(","));
const joinRecipients = SchemaGetter.transform((value: readonly string[]) => value.join(","));
const AlertEnvironment = Schema.Struct({
  ALERT_FROM: Email,
  ALERT_TO: Schema.String.pipe(
    Schema.decodeTo(Recipients, { decode: splitRecipients, encode: joinRecipients }),
  ),
});

abstract class Monitor<Bindings extends MonitorBindings> {
  protected abstract readonly event: string;
  protected abstract readonly failure: Alert;
  protected readonly ctx: DurableObjectState;
  protected readonly env: Bindings;

  public constructor(ctx: DurableObjectState, env: Bindings) {
    this.ctx = ctx;
    this.env = env;
  }

  public async fetch(): Promise<Response> {
    return this.ctx.blockConcurrencyWhile(async () => Effect.runPromise(this.run()));
  }

  private run(): Effect.Effect<Response, MonitorFailure> {
    return this.notifier().pipe(
      Effect.flatMap((notify) => {
        const started = Date.now();
        return Effect.exit(this.check(notify)).pipe(
          Effect.flatMap((outcome) =>
            Exit.isSuccess(outcome)
              ? this.reportSuccess(outcome.value, started)
              : this.reportFailure(notify, started, failureReason(outcome.cause)),
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

  private reportSuccess(result: object, started: number): Effect.Effect<Response> {
    return Effect.promise(async () => this.ctx.storage.delete("failureNotifiedDay")).pipe(
      Effect.andThen(() =>
        Console.log(
          JSON.stringify({
            event: `${this.event}.checked`,
            ...result,
            durationMs: Date.now() - started,
          }),
        ),
      ),
      Effect.map(() => Response.json({ ok: true, ...result })),
    );
  }

  private reportFailure(notify: Notify, started: number, reason: string): Effect.Effect<Response> {
    const { ctx, event, failure } = this;
    return Effect.gen(function* reportFailure() {
      yield* Console.error(
        JSON.stringify({
          durationMs: Date.now() - started,
          event: `${event}.check_failed`,
          reason,
        }),
      );
      const day = new Date(started).toISOString().slice(0, ISO_DATE_LENGTH);
      if (
        (yield* Effect.promise(async () => ctx.storage.get<string>("failureNotifiedDay"))) !== day
      ) {
        yield* notify(failure);
        yield* Effect.promise(async () => ctx.storage.put("failureNotifiedDay", day));
      }
      return Response.json({ ok: false, reason }, { status: httpStatus.internalServerError });
    });
  }

  protected abstract check(notify: Notify): Effect.Effect<object, unknown>;
}

function monitorWorker<Bindings extends MonitorBindings>(definition: {
  readonly check: (
    scope: { readonly ctx: DurableObjectState; readonly env: Bindings },
    notify: Notify,
  ) => Effect.Effect<object, unknown>;
  readonly className: string;
  readonly event: string;
  readonly failure: Alert;
}): {
  readonly Worker: new (ctx: DurableObjectState, env: Bindings) => Monitor<Bindings>;
  readonly handler: MonitorHandler;
} {
  const { check, className, event, failure } = definition;
  class Worker extends Monitor<Bindings> {
    protected readonly event = event;
    protected readonly failure = failure;

    protected check(notify: Notify): Effect.Effect<object, unknown> {
      return check({ ctx: this.ctx, env: this.env }, notify);
    }
  }
  Object.defineProperty(Worker, "name", { value: className });
  return { Worker, handler: monitorHandler(event) };
}

function monitorHandler(event: string): MonitorHandler {
  return {
    fetch: () => new Response("Not found", { status: httpStatus.notFound }),
    scheduled: async (_controller, env) => {
      const stub = env.MONITOR.get(env.MONITOR.idFromName(event));
      const result = await Effect.runPromise(
        Effect.promise(async () =>
          stub.fetch("https://monitor.internal/check", { method: "POST" }),
        ),
      );
      if (!result.ok) {
        await Effect.runPromise(Effect.die(`${event}_schedule_failed`));
      }
    },
  };
}

export { AlertEnvironment, maximumAlertRecipients, monitorBinding, monitorWorker };
export type { MonitorBindings };
