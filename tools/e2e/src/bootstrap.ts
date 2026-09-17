import { NodeRuntime } from "@effect/platform-node";
import { Database } from "@template/db";
import { bootstrapAdmin } from "@template/db/admin";
import { Effect, Schema } from "effect";
import { getPlatformProxy } from "wrangler";

class InvalidInput extends Schema.TaggedError<InvalidInput>()("InvalidInput", {}) {}

const BootstrapInput = Schema.Struct({
  config: Schema.String,
  persist: Schema.String,
  email: Schema.String.check(Schema.isPattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)),
});

const readInput = Effect.tryPromise({
  try: async () => {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
      if (!Buffer.isBuffer(chunk)) return Promise.reject(new InvalidInput());
      chunks.push(chunk);
    }
    return Buffer.concat(chunks).toString("utf8");
  },
  catch: () => new InvalidInput(),
}).pipe(
  Effect.flatMap((text) =>
    Effect.try({ try: (): unknown => JSON.parse(text), catch: () => new InvalidInput() }),
  ),
  Effect.flatMap((input) =>
    Schema.decodeUnknownEffect(BootstrapInput)(input, { onExcessProperty: "error" }).pipe(
      Effect.mapError(() => new InvalidInput()),
    ),
  ),
);

const platform = (input: typeof BootstrapInput.Type) =>
  Effect.acquireRelease(
    Effect.tryPromise(() =>
      getPlatformProxy<{ DB: Parameters<typeof Database.layer>[0] }>({
        configPath: input.config,
        envFiles: [],
        remoteBindings: false,
        persist: { path: input.persist },
      }),
    ),
    (proxy) => Effect.promise(() => proxy.dispose()),
  );

NodeRuntime.runMain(
  Effect.gen(function* () {
    const input = yield* readInput;
    const { env } = yield* platform(input);
    yield* bootstrapAdmin(input.email).pipe(Effect.provide(Database.layer(env.DB)));
    console.info(JSON.stringify({ ok: true, event: "e2e.admin_bootstrapped" }));
  }).pipe(
    Effect.scoped,
    Effect.catchCause(() =>
      Effect.sync(() => {
        console.error(JSON.stringify({ ok: false, event: "e2e.admin_bootstrap_failed" }));
        process.exitCode = 1;
      }),
    ),
  ),
  { disableErrorReporting: true },
);
