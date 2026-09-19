#!/usr/bin/env node
import { applications } from "@repo/config";
import { runCli } from "@repo/config/cli";
import { Console, Effect, Schema } from "effect";

import { deploymentAccess } from "./deployment-access.ts";
import { causeRecord, reportCause } from "./secrets.ts";

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
  const response = yield* Effect.tryPromise({
    catch: () => new OriginVerifyFailure({ code: "origin_unreachable", keys: [service] }),
    try: async (signal) =>
      fetch(`${origin}/api/health`, {
        redirect: "manual",
        signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
      }),
  });
  if (!response.ok) {
    return yield* Effect.fail(
      new OriginVerifyFailure({ code: "origin_unhealthy", keys: [service] }),
    );
  }
  const body = yield* Effect.tryPromise({
    catch: () => new OriginVerifyFailure({ code: "origin_unhealthy", keys: [service] }),
    try: async () => response.json(),
  });
  const health = yield* Schema.decodeUnknownEffect(HealthView)(body).pipe(
    Effect.mapError(() => new OriginVerifyFailure({ code: "origin_unhealthy", keys: [service] })),
  );
  if (health.service !== service) {
    return yield* Effect.fail(
      new OriginVerifyFailure({ code: "origin_unhealthy", keys: [service] }),
    );
  }
  yield* Console.info(
    JSON.stringify({
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
