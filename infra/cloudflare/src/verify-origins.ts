#!/usr/bin/env node
import { runCli } from "@repo/cli";
import { applications } from "@repo/config";
import { HealthView } from "@repo/runtime/contracts";
import { Console, Duration, Effect, Schema } from "effect";
import { FetchHttpClient, HttpClient } from "effect/unstable/http";

import { deploymentAccess } from "./deployment-access.ts";
import { encodeJson } from "./platform.ts";
import { causeRecord, reportCause } from "./secrets.ts";

const EVENT = "cloudflare.origin_verify_rejected";
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

runCli(
  Effect.gen(function* program() {
    const { confidential, config } = yield* deploymentAccess();
    yield* Effect.forEach(
      applications,
      (service) => probeOrigin(service, config.origins[service]),
      { concurrency: 1 },
    ).pipe(Effect.catchCause((cause) => reportCause(EVENT, cause, confidential)));
  }),
  (cause) => causeRecord(EVENT, cause),
);
