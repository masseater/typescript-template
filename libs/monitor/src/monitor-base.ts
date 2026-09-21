import { Email } from "@repo/config";
import { httpStatus } from "@repo/observability/http-status";
import { Cause, Console, Effect, Exit, Predicate, Schema, SchemaGetter } from "effect";

import { MonitorFailure } from "./failure.ts";

type Alert = {
  readonly subject: string;
  readonly text: string;
};

type Notify = (alert: Alert) => Effect.Effect<void>;

type MonitorBindings = {
  readonly ALERT_FROM: string;
  readonly ALERT_TO: string;
  readonly EMAIL: SendEmail;
  readonly MONITOR: DurableObjectNamespace;
};

const maximumAlertRecipients = 10;
const ISO_DATE_LENGTH = 10;

const UNRECOGNIZED_REASON = "unrecognized";
const declaredFailure = Schema.Struct({
  _tag: Schema.String.check(Schema.isPattern(/^[A-Za-z][A-Za-z0-9]{0,63}$/u)),
  code: Schema.String.check(Schema.isPattern(/^[a-z][a-z0-9_]{0,63}$/u)),
});
const isDeclaredFailure = Schema.is(declaredFailure);

const failureReason = (cause: Readonly<Cause.Cause<unknown>>): string => {
  const squashedFailure: unknown = Cause.squash(cause);
  if (!isDeclaredFailure(squashedFailure)) {
    return UNRECOGNIZED_REASON;
  }
  const base = `${squashedFailure._tag}.${squashedFailure.code}`;
  if (
    !Predicate.hasProperty(squashedFailure, "keys") ||
    !Array.isArray(squashedFailure.keys) ||
    squashedFailure.keys.length === 0 ||
    !squashedFailure.keys.every((failureKey) => typeof failureKey === "string")
  ) {
    return base;
  }
  return `${base}:${squashedFailure.keys.join(",")}`;
};

const Recipients = Schema.Array(Email).check(Schema.isLengthBetween(1, maximumAlertRecipients));
const splitRecipients = SchemaGetter.transform((recipientText: string) => recipientText.split(","));
const joinRecipients = SchemaGetter.transform((recipients: readonly string[]) =>
  recipients.join(","),
);
const AlertEnvironment = Schema.Struct({
  ALERT_FROM: Email,
  ALERT_TO: Schema.String.pipe(
    Schema.decodeTo(Recipients, { decode: splitRecipients, encode: joinRecipients }),
  ),
});

abstract class Monitor<Bindings extends MonitorBindings> {
  protected abstract readonly monitorEvent: string;
  protected abstract readonly failure: Alert;
  protected readonly durableState: DurableObjectState;
  protected readonly env: Bindings;

  public constructor(durableState: DurableObjectState, env: Bindings) {
    this.durableState = durableState;
    this.env = env;
  }

  public async fetch(): Promise<Response> {
    return this.durableState.blockConcurrencyWhile(async () => Effect.runPromise(this.run()));
  }

  private run(): Effect.Effect<Response, MonitorFailure> {
    return this.notifier().pipe(
      Effect.flatMap((notify) => {
        const started = Date.now();
        return Effect.exit(this.check(notify)).pipe(
          Effect.flatMap((checkExit) =>
            Exit.isSuccess(checkExit)
              ? this.reportSuccess(checkExit.value, started)
              : this.reportFailure({ notify, reason: failureReason(checkExit.cause), started }),
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

  private reportSuccess(checkReport: object, started: number): Effect.Effect<Response> {
    return Effect.promise(async () => this.durableState.storage.delete("failureNotifiedDay")).pipe(
      Effect.andThen(() =>
        Console.log(
          JSON.stringify({
            event: `${this.monitorEvent}.checked`,
            ...checkReport,
            durationMs: Date.now() - started,
          }),
        ),
      ),
      Effect.map(() => Response.json({ ok: true, ...checkReport })),
    );
  }

  private reportFailure(reported: {
    readonly notify: Notify;
    readonly reason: string;
    readonly started: number;
  }): Effect.Effect<Response> {
    const { durableState, monitorEvent, failure } = this;
    return Effect.gen(function* reportFailure() {
      yield* Console.error(
        JSON.stringify({
          durationMs: Date.now() - reported.started,
          event: `${monitorEvent}.check_failed`,
          reason: reported.reason,
        }),
      );
      const day = new Date(reported.started).toISOString().slice(0, ISO_DATE_LENGTH);
      if (
        (yield* Effect.promise(async () =>
          durableState.storage.get<string>("failureNotifiedDay"),
        )) !== day
      ) {
        yield* reported.notify(failure);
        yield* Effect.promise(async () => durableState.storage.put("failureNotifiedDay", day));
      }
      return Response.json(
        { ok: false, reason: reported.reason },
        { status: httpStatus.internalServerError },
      );
    });
  }

  protected abstract check(notify: Notify): Effect.Effect<object, unknown>;
}

export { AlertEnvironment, Monitor, maximumAlertRecipients };
export type { Alert, MonitorBindings, Notify };
