import { Effect, Option, Schema } from "effect";

import type { Application as HealthService } from "@repo/config";

type HealthTarget = {
  readonly service: HealthService;
  readonly origin: string;
  readonly healthEndpoint: string;
};

type ProbeResult = {
  readonly service: HealthService;
  readonly healthy: boolean;
  readonly detail: string;
};

type ProbeResponse = Readonly<Pick<Response, "json" | "ok" | "status">>;

const requestTimeoutMs = 10_000;

const HealthPayload = Schema.Struct({
  ok: Schema.Literal(true),
  release: Schema.String.check(Schema.isPattern(/^[a-zA-Z0-9._-]{1,64}$/u)),
  service: Schema.String,
});

const requestHealth = (
  healthTarget: HealthTarget,
): Effect.Effect<Option.Option<ProbeResponse>> =>
  Effect.tryPromise(async (signal): Promise<ProbeResponse> =>
    fetch(healthTarget.healthEndpoint, {
      headers: { accept: "application/json" },
      redirect: "manual",
      signal: AbortSignal.any([signal, AbortSignal.timeout(requestTimeoutMs)]),
    }),
  ).pipe(Effect.option);

const decodeHealthPayload = Effect.fn("decodeHealthPayload")(function* decodeHealthPayload(
  healthTarget: HealthTarget,
  healthResponse: ProbeResponse,
) {
  const outcomeOf = (asked: {
    readonly healthy: boolean;
    readonly detail: string;
  }): ProbeResult => ({
    detail: asked.detail,
    healthy: asked.healthy,
    service: healthTarget.service,
  });
  const responseBody = yield* Effect.tryPromise(async (): Promise<unknown> =>
    healthResponse.json(),
  ).pipe(Effect.option);
  if (Option.isNone(responseBody)) {
    return outcomeOf({ detail: "body_unreadable", healthy: false });
  }
  const healthPayload = yield* Schema.decodeUnknownEffect(HealthPayload)(responseBody.value).pipe(
    Effect.option,
  );
  if (Option.isNone(healthPayload) || healthPayload.value.service !== healthTarget.service) {
    return outcomeOf({ detail: "payload_invalid", healthy: false });
  }
  return outcomeOf({
    detail: `release_${healthPayload.value.release}`,
    healthy: true,
  });
});

const probeService = Effect.fn("probeService")(function* probeService(healthTarget: HealthTarget) {
  const outcomeOf = (asked: {
    readonly healthy: boolean;
    readonly detail: string;
  }): ProbeResult => ({
    detail: asked.detail,
    healthy: asked.healthy,
    service: healthTarget.service,
  });
  const healthResponse = yield* requestHealth(healthTarget);
  if (Option.isNone(healthResponse)) {
    return outcomeOf({ detail: "unreachable", healthy: false });
  }
  if (!healthResponse.value.ok) {
    return outcomeOf({
      detail: `status_${healthResponse.value.status}`,
      healthy: false,
    });
  }
  return yield* decodeHealthPayload(healthTarget, healthResponse.value);
});

export { probeService };
export type { ProbeResult };
