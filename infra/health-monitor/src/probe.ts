import { Duration, Effect, Layer, Option, Schema } from "effect";
import { FetchHttpClient, HttpClient, HttpClientResponse } from "effect/unstable/http";

import type { Application as HealthService } from "@repo/config";

interface HealthTarget {
  readonly service: HealthService;
  readonly origin: string;
}

interface ProbeResult {
  readonly service: HealthService;
  readonly healthy: boolean;
  readonly detail: string;
}

const REQUEST_TIMEOUT_MS = 10_000;
const healthHttp = Layer.mergeAll(
  FetchHttpClient.layer,
  Layer.succeed(FetchHttpClient.RequestInit, { redirect: "manual" }),
);

const HealthPayload = Schema.Struct({
  ok: Schema.Literal(true),
  release: Schema.String.check(Schema.isPattern(/^[a-zA-Z0-9._-]{1,64}$/u)),
  service: Schema.String,
});

function probeResult(target: HealthTarget, healthy: boolean, detail: string): ProbeResult {
  return { detail, healthy, service: target.service };
}

function requestHealth(
  target: HealthTarget,
): Effect.Effect<Option.Option<HttpClientResponse.HttpClientResponse>> {
  return HttpClient.get(`${target.origin}/api/health`, {
    headers: { accept: "application/json" },
  }).pipe(
    Effect.timeout(Duration.millis(REQUEST_TIMEOUT_MS)),
    Effect.provide(healthHttp),
    Effect.option,
  );
}

const payloadResult = Effect.fn("payloadResult")(function* payloadResult(
  target: HealthTarget,
  response: HttpClientResponse.HttpClientResponse,
) {
  const body = yield* response.json.pipe(Effect.option);
  if (Option.isNone(body)) {
    return probeResult(target, false, "body_unreadable");
  }
  const payload = yield* Schema.decodeUnknownEffect(HealthPayload)(body.value).pipe(Effect.option);
  if (Option.isNone(payload) || payload.value.service !== target.service) {
    return probeResult(target, false, "payload_invalid");
  }
  return probeResult(target, true, `release_${payload.value.release}`);
});

const probeService = Effect.fn("probeService")(function* probeService(target: HealthTarget) {
  const response = yield* requestHealth(target);
  if (Option.isNone(response)) {
    return probeResult(target, false, "unreachable");
  }
  if (response.value.status < 200 || response.value.status >= 300) {
    return probeResult(target, false, `status_${response.value.status}`);
  }
  return yield* payloadResult(target, response.value);
});

export { probeService };
export type { ProbeResult };
