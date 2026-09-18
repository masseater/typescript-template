// oxlint-disable-next-line import/no-nodejs-modules
import path from "node:path";

import { Effect, Schema } from "effect";
import { serve } from "srvx";
import { staticMiddleware } from "srvx/static";

import { loopbackAddress, loopbackOrigin } from "@repo/config";

const port = 3090;
const origin = loopbackOrigin(port);
const workspace = path.join(import.meta.dirname, "../..");

interface BuiltServer {
  readonly default: { readonly fetch: (request: Request) => Promise<Response> };
  readonly dispose: () => Promise<void>;
  readonly ready: () => Promise<void>;
}

class StartupFailed extends Schema.TaggedError<StartupFailed>()("StartupFailed", {
  cause: Schema.optionalKey(Schema.Defect()),
  reason: Schema.Literals(["build_unusable", "services_unavailable"]),
}) {}

function isBuiltServer(value: unknown): value is BuiltServer {
  return (
    typeof value === "object" &&
    value !== null &&
    "default" in value &&
    typeof value.default === "object" &&
    value.default !== null &&
    "fetch" in value.default &&
    typeof value.default.fetch === "function" &&
    "dispose" in value &&
    typeof value.dispose === "function" &&
    "ready" in value &&
    typeof value.ready === "function"
  );
}

const listen = Effect.fn("listen")(function* listen() {
  const built = yield* Effect.promise(
    async (): Promise<unknown> => import(path.join(workspace, "dist/server/server.js")),
  );
  if (!isBuiltServer(built)) {
    return yield* new StartupFailed({ reason: "build_unusable" });
  }
  yield* Effect.acquireRelease(
    Effect.tryPromise({
      catch: (cause) => new StartupFailed({ cause, reason: "services_unavailable" }),
      try: async () => built.ready(),
    }),
    () => Effect.promise(async () => built.dispose()),
  );
  const { fetch } = built.default;
  const server = yield* Effect.acquireRelease(
    Effect.sync(() =>
      serve({
        fetch: async (request) => fetch(request),
        hostname: loopbackAddress,
        middleware: [staticMiddleware({ dir: path.join(workspace, "dist/client") })],
        port,
        silent: true,
      }),
    ),
    (running) => Effect.promise(async () => running.close(true)),
  );
  yield* Effect.promise(async () => server.ready());
});

export { listen, origin };
