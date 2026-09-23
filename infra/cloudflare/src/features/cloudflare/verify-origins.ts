#!/usr/bin/env node
import { applications } from "@repo/config";
import { Console, Duration, Effect, Schema } from "effect";
import { FetchHttpClient, HttpClient } from "effect/unstable/http";

import { runDeploymentCommand } from "./deployment-access.ts";
import { encodeJson } from "./platform.ts";

const EVENT = "cloudflare.origin_verify_rejected";
const HealthView = Schema.Struct({
  ok: Schema.Literal(true),
  release: Schema.String,
  service: Schema.Literals(applications),
});

class OriginVerifyFailure extends Schema.TaggedError<OriginVerifyFailure>()("OriginVerifyFailure", {
  code: Schema.Literals(["origin_unreachable", "origin_unhealthy"]),
  keys: Schema.Array(Schema.String),
}) {}

const probeOrigin = Effect.fn("probeOrigin")(function* probeOrigin(
  service: (typeof applications)[number],
  origin: string,
) {
  const response = yield* HttpClient.get(new URL("/api/health", origin).href, {
    headers: { accept: "application/json" },
  }).pipe(
    Effect.timeout(Duration.seconds(15)),
    Effect.provide(FetchHttpClient.layer),
    Effect.mapError(() => new OriginVerifyFailure({ code: "origin_unreachable", keys: [service] })),
  );
  if (response.status < 200 || response.status > 299) {
    return yield* new OriginVerifyFailure({ code: "origin_unhealthy", keys: [service] });
  }
  const health = yield* response.json.pipe(
    Effect.flatMap(Schema.decodeUnknownEffect(HealthView)),
    Effect.mapError(() => new OriginVerifyFailure({ code: "origin_unhealthy", keys: [service] })),
  );
  if (health.service !== service) {
    return yield* new OriginVerifyFailure({ code: "origin_unhealthy", keys: [service] });
  }
  yield* Console.info(
    yield* encodeJson({
      event: "cloudflare.origin_healthy",
      origin,
      release: health.release,
      service,
    }),
  );
});

runDeploymentCommand(EVENT, Effect.void, (_input, { config }) =>
  Effect.forEach(applications, (service) => probeOrigin(service, config.origins[service]), {
    concurrency: 1,
  }),
);
