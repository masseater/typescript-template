import { Effect, Exit, Schema, SchemaGetter } from "effect";

const Email = Schema.String.check(Schema.isPattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/));

export const AlertEnvironment = Schema.Struct({
  ALERT_FROM: Email,
  ALERT_TO: Schema.String.pipe(
    Schema.decodeTo(Schema.Array(Email).check(Schema.isLengthBetween(1, 10)), {
      decode: SchemaGetter.transform((value: string) => value.split(",")),
      encode: SchemaGetter.transform((value: readonly string[]) => value.join(",")),
    }),
  ),
});

export class MonitorFailure extends Schema.TaggedError<MonitorFailure>()("MonitorFailure", {
  code: Schema.Literal("alert_config_invalid"),
}) {}

export interface MonitorBindings {
  MONITOR: DurableObjectNamespace;
  EMAIL: SendEmail;
  ALERT_FROM: string;
  ALERT_TO: string;
}

export interface Alert {
  readonly subject: string;
  readonly text: string;
}

export type Notify = (alert: Alert) => Effect.Effect<void>;

export abstract class Monitor<Bindings extends MonitorBindings> {
  protected readonly ctx: DurableObjectState;
  protected readonly env: Bindings;

  constructor(ctx: DurableObjectState, env: Bindings) {
    this.ctx = ctx;
    this.env = env;
  }

  protected abstract readonly event: string;
  protected abstract readonly failure: Alert;
  protected abstract check(notify: Notify): Effect.Effect<object, unknown>;

  fetch(): Promise<Response> {
    const { ctx, env, event, failure } = this;
    const check = (notify: Notify) => this.check(notify);
    const run = Effect.fn(`${event}.run`)(function* () {
      const recipients = yield* Schema.decodeUnknownEffect(AlertEnvironment)(env).pipe(
        Effect.mapError(() => new MonitorFailure({ code: "alert_config_invalid" })),
      );
      const notify: Notify = (alert) =>
        Effect.promise(() =>
          env.EMAIL.send({ from: recipients.ALERT_FROM, to: [...recipients.ALERT_TO], ...alert }),
        );
      const started = Date.now();
      const outcome = yield* Effect.exit(check(notify));
      if (Exit.isSuccess(outcome)) {
        yield* Effect.promise(() => ctx.storage.delete("failureNotifiedDay"));
        console.log(
          JSON.stringify({
            event: `${event}.checked`,
            ...outcome.value,
            durationMs: Date.now() - started,
          }),
        );
        return Response.json({ ok: true, ...outcome.value });
      }
      console.error(
        JSON.stringify({ event: `${event}.check_failed`, durationMs: Date.now() - started }),
      );
      const day = new Date(started).toISOString().slice(0, 10);
      if ((yield* Effect.promise(() => ctx.storage.get<string>("failureNotifiedDay"))) !== day) {
        yield* notify(failure);
        yield* Effect.promise(() => ctx.storage.put("failureNotifiedDay", day));
      }
      return yield* Effect.die(`${event}_check_failed`);
    });
    return ctx.blockConcurrencyWhile(() => Effect.runPromise(run()));
  }
}

export const monitorHandler = (event: string) =>
  ({
    fetch: () => new Response("Not found", { status: 404 }),
    scheduled: (_controller: ScheduledController, env: MonitorBindings) =>
      Effect.runPromise(
        Effect.gen(function* () {
          const stub = env.MONITOR.get(env.MONITOR.idFromName(event));
          const result = yield* Effect.promise(() =>
            stub.fetch("https://monitor.internal/check", { method: "POST" }),
          );
          if (!result.ok) return yield* Effect.die(`${event}_schedule_failed`);
        }),
      ),
  }) satisfies ExportedHandler<MonitorBindings>;
