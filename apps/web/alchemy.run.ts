import { D1, Website, Workers, providers, state } from "@alchemy.run/cloudflare";
import type { InferEnv } from "@alchemy.run/cloudflare";
import { withWorkersTracing } from "@r_masseater/workers-tracing/alchemy";
import { RemovalPolicy, Stack, makeRandom } from "alchemy";
import { Effect, Hash } from "effect";
import { SECURITY_HEADERS, STATIC_PAGE_HEADERS, assetHeaders } from "security-headers";

import { APP_NAME, requireAppPrefix } from "./alchemy.app-name.ts";

const API_RATE_LIMIT = Workers.RateLimit("API_RATE_LIMIT", {
  namespaceId: Math.abs(Hash.string(APP_NAME)),
  simple: { limit: 100, period: 60 },
});

const CF_BEACON_TOKEN = "47d660a773db4bb7a9b283aaf8f080ff";

const JAPAN_DATABASE_HINT = "apac";

const web = Effect.gen(function* web() {
  yield* D1.Database("DB", { migrations: "./drizzle" }).pipe(RemovalPolicy.destroy());
  const DB = yield* D1.Database("DBJapan", {
    migrations: "./drizzle",
    primaryLocationHint: JAPAN_DATABASE_HINT,
  }).pipe(RemovalPolicy.protect());
  const BETTER_AUTH_SECRET = yield* makeRandom("BetterAuthSecret");
  return yield* Website.Vite("Web", {
    logpush: true,
    limits: { cpuMs: 1000 },
    env: { API_RATE_LIMIT, BETTER_AUTH_SECRET, CF_BEACON_TOKEN, DB },
    viteEnvironments: { entry: "ssr", children: ["rsc"] },
    assets: { headers: assetHeaders(SECURITY_HEADERS) },
  });
});

const landingPage = Website.StaticSite("LandingPage", {
  cwd: "../lp",
  env: { VITE_CF_BEACON_TOKEN: CF_BEACON_TOKEN },
  command: "vp build",
  outdir: "dist/client",
  logpush: true,
  assets: { headers: assetHeaders(STATIC_PAGE_HEADERS) },
  dev: { command: "vp dev" },
});

export type WebEnv = InferEnv<typeof web>;

export default Stack(
  APP_NAME,
  {
    providers: withWorkersTracing({ destinations: ["masseater-dev-traces"] })(providers()),
    state: state(),
  },
  Effect.gen(function* stack() {
    const { url } = yield* web;
    const { url: landingPageUrl } = yield* landingPage;
    yield* requireAppPrefix;
    return { url, landingPageUrl };
  }),
);
