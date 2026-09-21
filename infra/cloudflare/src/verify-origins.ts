#!/usr/bin/env node
// oxlint-disable-next-line import/no-nodejs-modules -- this file runs in Node and calls a Node API that has no portable module
import { resolve4, resolve6 } from "node:dns/promises";
// oxlint-disable-next-line import/no-nodejs-modules -- this file runs in Node and calls a Node API that has no portable module
import { request } from "node:https";
// oxlint-disable-next-line import/no-nodejs-modules -- this file runs in Node and calls a Node API that has no portable module
import { URL } from "node:url";

import { runCli } from "@repo/cli";
import { HealthView } from "@repo/runtime/contracts";
import { Console, Effect, Schema } from "effect";

import { deploymentAccess } from "./deployment-access.ts";
import { causeRecord, reportCause } from "./secrets.ts";

const EVENT = "cloudflare.origin_verify_rejected";

class OriginVerifyFailure extends Schema.TaggedError<OriginVerifyFailure>()("OriginVerifyFailure", {
  code: Schema.Literals(["origin_unreachable", "origin_unhealthy"]),
  keys: Schema.Array(Schema.String),
}) {}

async function resolveAddress(hostname: string): Promise<string> {
  try {
    const [address] = await resolve4(hostname);
    if (address !== undefined) {
      return address;
    }
  } catch {
    // Prefer A; fall through to AAAA when A is absent.
  }
  const [address] = await resolve6(hostname);
  if (address === undefined) {
    throw new Error("origin_dns_empty");
  }
  return address;
}

function fetchHealth(
  origin: string,
  signal: AbortSignal,
): Promise<{ readonly ok: boolean; readonly json: unknown }> {
  const target = new URL("/api/health", origin);
  return resolveAddress(target.hostname).then(
    async (address) =>
      new Promise<{ readonly ok: boolean; readonly json: unknown }>((resolve, reject) => {
        const req = request(
          {
            family: address.includes(":") ? 6 : 4,
            headers: { accept: "application/json", host: target.host },
            hostname: address,
            method: "GET",
            path: `${target.pathname}${target.search}`,
            port: target.port === "" ? 443 : Number(target.port),
            servername: target.hostname,
            signal,
          },
          (response) => {
            const chunks: Buffer[] = [];
            response.on("data", (chunk: Buffer) => {
              chunks.push(chunk);
            });
            response.on("end", () => {
              const text = Buffer.concat(chunks).toString("utf8");
              const status = response.statusCode ?? 0;
              if (status < 200 || status > 299) {
                resolve({ json: undefined, ok: false });
                return;
              }
              try {
                resolve({ json: JSON.parse(text) as unknown, ok: true });
              } catch {
                resolve({ json: undefined, ok: false });
              }
            });
          },
        );
        req.on("error", reject);
        req.end();
      }),
  );
}

const probeOrigin = Effect.fn("probeOrigin")(function* probeOrigin(
  service: (typeof applications)[number],
  origin: string,
) {
  const response = yield* Effect.tryPromise({
    catch: () => new OriginVerifyFailure({ code: "origin_unreachable", keys: [service] }),
    try: async (signal) =>
      fetchHealth(origin, AbortSignal.any([signal, AbortSignal.timeout(15_000)])),
  });
  if (!response.ok) {
    return yield* Effect.fail(
      new OriginVerifyFailure({ code: "origin_unhealthy", keys: [service] }),
    );
  }
  const health = yield* Schema.decodeUnknownEffect(HealthView)(response.json).pipe(
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
