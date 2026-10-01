import { Stack, makeRandom } from "alchemy";
import { D1, Website, providers, state } from "alchemy/Cloudflare";
import type { InferEnv } from "alchemy/Cloudflare";
import { Config, Effect, Option, Schema } from "effect";

const OTLP = "otlp";
const NonEmptySecret = Schema.Redacted(Schema.NonEmptyString);

const otlpEnv = Config.all({
  endpoint: Config.option(Config.NonEmptyString("OTEL_EXPORTER_OTLP_ENDPOINT")),
  headers: Config.option(Config.schema(NonEmptySecret, "OTEL_EXPORTER_OTLP_HEADERS")),
}).pipe(
  Config.map(({ endpoint, headers }) =>
    Option.match(endpoint, {
      onNone: () => ({}),
      onSome: (OTEL_EXPORTER_OTLP_ENDPOINT) => ({
        OTEL_EXPORTER_OTLP_ENDPOINT,
        OTEL_TRACES_EXPORTER: OTLP,
        OTEL_METRICS_EXPORTER: OTLP,
        OTEL_LOGS_EXPORTER: OTLP,
        ...Option.match(headers, {
          onNone: () => ({}),
          onSome: (OTEL_EXPORTER_OTLP_HEADERS) => ({ OTEL_EXPORTER_OTLP_HEADERS }),
        }),
      }),
    }),
  ),
);

const web = Effect.gen(function* web() {
  const DB = yield* D1.Database("DB", { migrations: "./drizzle" });
  const BETTER_AUTH_SECRET = yield* makeRandom("BetterAuthSecret");
  const otlp = yield* otlpEnv;
  return yield* Website.Vite("Web", {
    env: { ...otlp, BETTER_AUTH_SECRET, DB },
    observability: { enabled: true, traces: { enabled: true } },
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
