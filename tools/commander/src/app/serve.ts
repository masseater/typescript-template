// oxlint-disable-next-line import/no-nodejs-modules
import path from "node:path";

import { Effect, Schema } from "effect";
import type { Scope } from "effect";

import { playbookDirectory } from "#shared/playbook/index.ts";
import { loopbackAddress, loopbackOrigin } from "@repo/config";

import { nodeServer } from "./node-server.ts";

interface Served {
  readonly directory: string;
  readonly model: string | undefined;
  readonly port: number;
  readonly stateDirectory: string;
}

interface BuiltServer {
  readonly default: { readonly fetch: (request: Request) => Promise<Response> };
  readonly dispose: () => Promise<void>;
  readonly ready: () => Promise<void>;
}

class StartupFailed extends Schema.TaggedError<StartupFailed>()("StartupFailed", {
  cause: Schema.optionalKey(Schema.Defect()),
  reason: Schema.Literals(["build_unusable", "services_unavailable", "not_listening"]),
}) {}

const workspace = path.join(import.meta.dirname, "../..");

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

function configure(settings: Readonly<Record<string, string | undefined>>): void {
  for (const [name, value] of Object.entries(settings)) {
    if (value !== undefined) {
      // oxlint-disable-next-line node/no-process-env
      process.env[name] = value;
    }
  }
}

const builtServer = Effect.fn("builtServer")(function* builtServer() {
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
  return built.default.fetch;
});

function serveCommander(served: Served): Effect.Effect<URL, StartupFailed, Scope.Scope> {
  return Effect.gen(function* serving() {
    configure({
      COMMANDER_ASSETS: playbookDirectory,
      COMMANDER_DIRECTORY: served.directory,
      COMMANDER_EXECUTABLE: "claude",
      COMMANDER_MODEL: served.model,
      COMMANDER_ORIGIN: loopbackOrigin(served.port),
      COMMANDER_STATE: served.stateDirectory,
    });
    const fetch = yield* builtServer();
    const server = yield* Effect.acquireRelease(
      Effect.sync(() =>
        nodeServer({
          fetch,
          hostname: loopbackAddress,
          port: served.port,
          staticDirectory: path.join(workspace, "dist/client"),
        }),
      ),
      (running) => Effect.promise(async () => running.close(true)),
    );
    const { url } = yield* Effect.promise(async () => server.ready());
    return url === undefined ? yield* new StartupFailed({ reason: "not_listening" }) : new URL(url);
  });
}

export { serveCommander };
