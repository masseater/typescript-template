import { D1, Website, Workers, providers, state } from "@alchemy.run/cloudflare";
import type { InferEnv } from "@alchemy.run/cloudflare";
import { Stack, makeRandom } from "alchemy";
import { Effect, Hash } from "effect";
import { SECURITY_HEADERS, STATIC_PAGE_HEADERS, assetHeaders } from "security-headers";

import { APP_NAME, requireAppPrefix } from "./app-name.ts";

const COMPATIBILITY = { date: "2026-08-25" } as const;

const WEB_LIMITS = { cpuMs: 1000 } as const;

const API_RATE_LIMIT = Workers.RateLimit("API_RATE_LIMIT", {
  namespaceId: Math.abs(Hash.string(APP_NAME)),
  simple: { limit: 100, period: 60 },
});

const CF_BEACON_TOKEN = "47d660a773db4bb7a9b283aaf8f080ff";

const web = Effect.gen(function* web() {
  const DB = yield* D1.Database("DB", { migrations: "./drizzle" });
  const BETTER_AUTH_SECRET = yield* makeRandom("BetterAuthSecret");
  return yield* Website.Vite("Web", {
    compatibility: COMPATIBILITY,
    logpush: true,
    limits: WEB_LIMITS,
    env: { API_RATE_LIMIT, BETTER_AUTH_SECRET, CF_BEACON_TOKEN, DB },
    observability: {
      enabled: true,
      logs: {
        enabled: true,
        invocationLogs: true,
        persist: true,
      },
      traces: { enabled: true, persist: true },
    },
    viteEnvironments: { entry: "ssr", children: ["rsc"] },
    assets: { headers: assetHeaders(SECURITY_HEADERS) },
  });
});

const landingPage = Website.StaticSite("LandingPage", {
  cwd: "../lp",
  env: { VITE_CF_BEACON_TOKEN: CF_BEACON_TOKEN },
  command: "vp run build",
  outdir: "dist/client",
  compatibility: COMPATIBILITY,
  logpush: true,
  assets: { headers: assetHeaders(STATIC_PAGE_HEADERS) },
  dev: { command: "vp dev" },
});

type WebEnv = InferEnv<typeof web>;

export type { WebEnv };
export default Stack(
  APP_NAME,
  { providers: providers(), state: state() },
  Effect.gen(function* stack() {
    const { url } = yield* web;
    const { url: landingPageUrl } = yield* landingPage;
    yield* requireAppPrefix;
    return { url, landingPageUrl };
  }),
);
