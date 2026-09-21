import { Effect, Option, Schema } from "effect";
import { FetchHttpClient, HttpClient, HttpClientResponse } from "effect/unstable/http";

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

const HealthPayload = Schema.Struct({
  ok: Schema.Literal(true),
  release: Schema.String.check(Schema.isPattern(/^[a-zA-Z0-9._-]{1,64}$/u)),
  service: Schema.String,
});

const observedProbe = (asked: {
  readonly healthTarget: HealthTarget;
  readonly healthy: boolean;
  readonly detail: string;
}): ProbeResult => ({
  detail: asked.detail,
  healthy: asked.healthy,
  service: asked.healthTarget.service,
});

const decodeHealthPayload = Effect.fn("decodeHealthPayload")(function* decodeHealthPayload(
  healthTarget: HealthTarget,
  healthResponse: HttpClientResponse.HttpClientResponse,
) {
  const responseBody = yield* HttpClientResponse.schemaBodyJson(Schema.Unknown)(healthResponse).pipe(
    Effect.option,
  );
  if (Option.isNone(responseBody)) {
    return observedProbe({ detail: "body_unreadable", healthTarget, healthy: false });
  }
  const decodedPayload = yield* Schema.decodeUnknownEffect(HealthPayload)(responseBody.value).pipe(
    Effect.option,
  );
  if (Option.isNone(decodedPayload) || decodedPayload.value.service !== healthTarget.service) {
    return observedProbe({ detail: "payload_invalid", healthTarget, healthy: false });
  }
  return observedProbe({
    detail: `release_${decodedPayload.value.release}`,
    healthTarget,
    healthy: true,
  });
});

const probeService = Effect.fn("probeService")(function* probeService(healthTarget: HealthTarget) {
  const healthResponse = yield* HttpClient.get(healthTarget.healthEndpoint, {
    headers: { accept: "application/json" },
  }).pipe(Effect.provide(FetchHttpClient.layer), Effect.option);
  if (Option.isNone(healthResponse)) {
    return observedProbe({ detail: "unreachable", healthTarget, healthy: false });
  }
  if (healthResponse.value.status < 200 || healthResponse.value.status >= 300) {
    return observedProbe({
      detail: `status_${healthResponse.value.status}`,
      healthTarget,
      healthy: false,
    });
  }
  return yield* decodeHealthPayload(healthTarget, healthResponse.value);
});

export { probeService };
export type { ProbeResult };
