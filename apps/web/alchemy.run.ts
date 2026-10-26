import { Stack, makeRandom } from "alchemy";
import { D1, Website, Workers, providers, state } from "alchemy/Cloudflare";
import type { InferEnv } from "alchemy/Cloudflare";
import { Array as Arr, Config, Effect, Option, Record as Rec, Schema, pipe } from "effect";

import { APP_NAME, CI_TELEMETRY_AUDIENCE, requireAppPrefix } from "./app-name.ts";
import { edgeGuard } from "./edge-guard.ts";
import { logArchive } from "./log-archive.ts";
import { ASSET_CACHE_CONTROL, SECURITY_HEADERS } from "./src/shared/config/index.ts";

const TRACE_SAMPLING_RATE = 0.1;

const COMPATIBILITY = { date: "2026-08-25" } as const;

const ASSET_HEADERS = pipe(
  [
    "/*",
    ...pipe(
      Rec.toEntries(SECURITY_HEADERS),
      Arr.map(([name, value]) => `  ${name}: ${value}`),
    ),
    "/assets/*",
    `  Cache-Control: ${ASSET_CACHE_CONTROL}`,
    "",
  ],
  Arr.join("\n"),
);

const OWNED_ZONE = Option.none<string>();

const web = Effect.gen(function* web() {
  const DB = yield* D1.Database("DB", { migrations: "./drizzle" });
  const BETTER_AUTH_SECRET = yield* makeRandom("BetterAuthSecret");
  return yield* Website.Vite("Web", {
    compatibility: COMPATIBILITY,
    logpush: true,
    env: { BETTER_AUTH_SECRET, DB },
    observability: {
      enabled: true,
      logs: {
        enabled: true,
        invocationLogs: true,
        persist: true,
      },
      traces: { enabled: true, headSamplingRate: TRACE_SAMPLING_RATE, persist: true },
    },
    viteEnvironments: { entry: "ssr", children: ["rsc"] },
    assets: { headers: ASSET_HEADERS },
  });
});

const ciTelemetry = Effect.gen(function* ciTelemetry() {
  const GITHUB_REPOSITORY = yield* Config.schema(Schema.String, "GITHUB_REPOSITORY").pipe(
    Config.withDefault(""),
  );
  return yield* Workers.Worker("CiTelemetry", {
    name: CI_TELEMETRY_AUDIENCE,
    main: "./ci-telemetry.worker.ts",
    compatibility: COMPATIBILITY,
    logpush: true,
    env: { GITHUB_REPOSITORY },
    observability: {
      enabled: true,
      logs: { enabled: true, invocationLogs: false, persist: true },
    },
  });
});

type WebEnv = InferEnv<typeof web>;
type CiTelemetryEnv = InferEnv<typeof ciTelemetry>;

export type { CiTelemetryEnv, WebEnv };
export default Stack(
  APP_NAME,
  { providers: providers(), state: state() },
  Effect.gen(function* stack() {
    const { url } = yield* web;
    yield* Option.match(OWNED_ZONE, {
      onNone: () => Effect.void,
      onSome: (zone) =>
        Effect.gen(function* accountWide() {
          yield* edgeGuard(zone, COMPATIBILITY);
          yield* logArchive;
        }),
    });
    yield* ciTelemetry;
    yield* requireAppPrefix;
    return { url };
  }),
);
