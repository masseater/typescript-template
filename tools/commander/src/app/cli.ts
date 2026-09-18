// oxlint-disable-next-line import/no-nodejs-modules
import { parseArgs } from "node:util";

import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Console, Effect, Schema } from "effect";
import open from "open";

import { reportFailed } from "./failure.ts";
import { resolveProject } from "./project.ts";
import { serveCommander } from "./serve.ts";

const hostname = "127.0.0.1";
const port = 3090;
const origin = `http://${hostname}:${port}`;

const Input = Schema.Struct({
  directory: Schema.optional(Schema.String),
  model: Schema.optional(Schema.String),
});

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

const start = Effect.fn("start")(function* start() {
  const input = yield* Schema.decodeUnknownEffect(Input)({
    directory: positionals[0],
    model: values.model,
  });
  const project = yield* resolveProject(input.directory, process.cwd());
  yield* serveCommander({ ...project, hostname, model: input.model, port });
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
