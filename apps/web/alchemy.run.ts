import { Stack, makeRandom } from "alchemy";
import { D1, Website, providers, state } from "alchemy/Cloudflare";
import type { InferEnv } from "alchemy/Cloudflare";
import { Effect } from "effect";

const SAMPLING_RATE = 0.1;

const web = Effect.gen(function* web() {
  const DB = yield* D1.Database("DB", { migrations: "./drizzle" });
  const BETTER_AUTH_SECRET = yield* makeRandom("BetterAuthSecret");
  return yield* Website.Vite("Web", {
    compatibility: { date: "2026-08-25" },
    env: { BETTER_AUTH_SECRET, DB },
    observability: {
      enabled: true,
      logs: {
        enabled: true,
        invocationLogs: true,
        headSamplingRate: SAMPLING_RATE,
        persist: true,
      },
      traces: { enabled: true, headSamplingRate: SAMPLING_RATE, persist: true },
    },
    viteEnvironments: { entry: "ssr", children: ["rsc"] },
  });
});

type WebEnv = InferEnv<typeof web>;

export type { WebEnv };
export default Stack(
  "web",
  { providers: providers(), state: state() },
  Effect.gen(function* stack() {
    const { url } = yield* web;
    return { url };
  }),
);
