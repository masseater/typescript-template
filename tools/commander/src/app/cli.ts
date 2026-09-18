// oxlint-disable-next-line import/no-nodejs-modules
import path from "node:path";
// oxlint-disable-next-line import/no-nodejs-modules
import { parseArgs } from "node:util";

import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Console, Effect, Schema } from "effect";
import open from "open";
import { serve } from "srvx";
import { staticMiddleware } from "srvx/static";

import { playbookDirectory } from "#shared/playbook/index.ts";
import { reportFailed } from "@repo/config/cli";

import { resolveProject } from "./project.ts";

const host = "127.0.0.1";
const port = 3090;
const origin = `http://${host}:${port}`;
const workspace = path.join(import.meta.dirname, "../..");

const Input = Schema.Struct({
  directory: Schema.optional(Schema.String),
  model: Schema.optional(Schema.String),
});

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

const { values, positionals } = parseArgs({
  allowNegative: true,
  allowPositionals: true,
  options: {
    help: { default: false, type: "boolean" },
    model: { type: "string" },
    open: { default: true, type: "boolean" },
  },
});

const help = Console.log(
  JSON.stringify({
    arguments: ["[project directory: defaults to the repository containing the current directory]"],
    flags: [
      "--model <model passed to claude: defaults to the claude default; use sonnet or better, haiku skips the review step>",
      "--no-open: do not open the browser",
    ],
    serves: origin,
  }),
);

function configure(settings: Readonly<Record<string, string | undefined>>): void {
  for (const [name, value] of Object.entries(settings)) {
    if (value !== undefined) {
      // oxlint-disable-next-line node/no-process-env
      process.env[name] = value;
    }
  }
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
        hostname: host,
        middleware: [staticMiddleware({ dir: path.join(workspace, "dist/client") })],
        port,
        silent: true,
      }),
    ),
    (running) => Effect.promise(async () => running.close(true)),
  );
  yield* Effect.promise(async () => server.ready());
});

const start = Effect.fn("start")(function* start() {
  const input = yield* Schema.decodeUnknownEffect(Input)({
    directory: positionals[0],
    model: values.model,
  });
  const project = yield* resolveProject(input.directory, process.cwd());
  configure({
    COMMANDER_ASSETS: playbookDirectory,
    COMMANDER_DIRECTORY: project.directory,
    COMMANDER_EXECUTABLE: "claude",
    COMMANDER_MODEL: input.model,
    COMMANDER_ORIGIN: origin,
    COMMANDER_STATE: project.stateDirectory,
  });
  yield* listen();
  yield* Console.log(JSON.stringify({ ...project, event: "commander.started", url: origin }));
  if (values.open) {
    yield* Effect.promise(async () => open(origin));
  }
  return yield* Effect.never;
});

function startFailed(cause: unknown): Effect.Effect<void> {
  return reportFailed({
    cause: String(cause),
    event: "commander.start_failed",
    ok: false,
    remediation: `Check that ${origin} is free, that bd and claude are installed, and that the workspace was built (vp run @repo/commander#start builds first).`,
  });
}

const main = Effect.scoped(start()).pipe(
  Effect.provide(NodeServices.layer),
  Effect.catchCause((cause) => startFailed(cause)),
);

NodeRuntime.runMain(values.help ? help : main, { disableErrorReporting: true });
