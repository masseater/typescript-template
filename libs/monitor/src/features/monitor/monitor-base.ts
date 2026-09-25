import { Email, httpStatus } from "@repo/config";
import {
  Cause,
  Clock,
  Console,
  DateTime,
  Effect,
  Exit,
  Predicate,
  Schema,
  SchemaGetter,
} from "effect";

import { MonitorFailure } from "./failure.ts";

import type {
  DurableObjectNamespace,
  DurableObjectState,
  SendEmail,
} from "@cloudflare/workers-types";

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

const notifierOf = (env: MonitorBindings): Effect.Effect<Notify, MonitorFailure> =>
  Schema.decodeUnknownEffect(AlertEnvironment)(env).pipe(
    Effect.mapError(() => new MonitorFailure({ code: "alert_config_invalid" })),
    Effect.map(
      (recipients): Notify =>
        (alert) =>
          Effect.promise(() =>
            Promise.resolve(
              env.EMAIL.send({
                from: recipients.ALERT_FROM,
                to: [...recipients.ALERT_TO],
                ...alert,
              }),
            ),
          ),
    ),
  );

const reportSuccess = ({
  checkReport,
  durableState,
  monitorEvent,
  started,
}: {
  readonly checkReport: object;
  readonly durableState: DurableObjectState;
  readonly monitorEvent: string;
  readonly started: number;
}): Effect.Effect<Response> =>
  Effect.gen(function* reportSuccess() {
    yield* Effect.promise(() => durableState.storage.delete("failureNotifiedDay"));
    const durationMs = (yield* Clock.currentTimeMillis) - started;
    yield* Console.log(
      yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
        event: `${monitorEvent}.checked`,
        ...checkReport,
        durationMs,
      }).pipe(Effect.orDie),
    );
    return Response.json({ ok: true, ...checkReport });
  });

const reportFailure = ({
  durableState,
  failure,
  monitorEvent,
  notify,
  reason,
  started,
}: {
  readonly durableState: DurableObjectState;
  readonly failure: Alert;
  readonly monitorEvent: string;
  readonly notify: Notify;
  readonly reason: string;
  readonly started: number;
}): Effect.Effect<Response> =>
  Effect.gen(function* reportFailure() {
    const durationMs = (yield* Clock.currentTimeMillis) - started;
    yield* Console.error(
      yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
        durationMs,
        event: `${monitorEvent}.check_failed`,
        reason,
      }).pipe(Effect.orDie),
    );
    const day = DateTime.formatIsoDateUtc(DateTime.makeUnsafe(started));
    if (
      (yield* Effect.promise(() => durableState.storage.get<string>("failureNotifiedDay"))) !== day
    ) {
      yield* notify(failure);
      yield* Effect.promise(() => durableState.storage.put("failureNotifiedDay", day));
    }
    return Response.json({ ok: false, reason }, { status: httpStatus.internalServerError });
  });

const runMonitor = ({
  check,
  durableState,
  env,
  failure,
  monitorEvent,
}: {
  readonly check: (notify: Notify) => Effect.Effect<object, unknown>;
  readonly durableState: DurableObjectState;
  readonly env: MonitorBindings;
  readonly failure: Alert;
  readonly monitorEvent: string;
}): Promise<Response> =>
  durableState.blockConcurrencyWhile(() =>
    Effect.runPromise(
      Effect.gen(function* runCheck() {
        const notify = yield* notifierOf(env);
        const started = yield* Clock.currentTimeMillis;
        const outcome = yield* Effect.exit(check(notify));
        return Exit.isSuccess(outcome)
          ? yield* reportSuccess({
              checkReport: outcome.value,
              durableState,
              monitorEvent,
              started,
            })
          : yield* reportFailure({
              durableState,
              failure,
              monitorEvent,
              notify,
              reason: failureReason(outcome.cause),
              started,
            });
      }),
    ),
  );

export { AlertEnvironment, Recipients, runMonitor };
export type { Alert, MonitorBindings, Notify };
