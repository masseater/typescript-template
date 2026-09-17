import type { Application as HealthService } from "@template/config";
import { Effect, Schema } from "effect";

export interface HealthTarget {
  readonly service: HealthService;
  readonly origin: string;
}

export interface ProbeResult {
  readonly service: HealthService;
  readonly healthy: boolean;
  readonly detail: string;
}

const HealthPayload = Schema.Struct({
  ok: Schema.Literal(true),
  service: Schema.String,
  release: Schema.String.check(Schema.isPattern(/^[a-zA-Z0-9._-]{1,64}$/)),
});

export const probeService = Effect.fn("probeService")(function* (target: HealthTarget) {
  const result = (healthy: boolean, detail: string): ProbeResult => ({
    service: target.service,
    healthy,
    detail,
  });
  const response = yield* Effect.tryPromise((signal) =>
    fetch(`${target.origin}/api/health`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]),
      redirect: "manual",
    }),
  ).pipe(Effect.option);
  if (response._tag === "None") return result(false, "unreachable");
  const { status } = response.value;
  if (!response.value.ok) return result(false, `status_${status}`);
  const body = yield* Effect.tryPromise((): Promise<unknown> => response.value.json()).pipe(
    Effect.option,
  );
  if (body._tag === "None") return result(false, "body_unreadable");
  const payload = yield* Schema.decodeUnknownEffect(HealthPayload)(body.value).pipe(Effect.option);
  if (payload._tag === "None" || payload.value.service !== target.service)
    return result(false, "payload_invalid");
  return result(true, `release_${payload.value.release}`);
});
