// oxlint-disable-next-line import/no-nodejs-modules
import { parseArgs } from "node:util";

import { NodeServices } from "@effect/platform-node";
import { Console, Effect, Schema } from "effect";
import open from "open";

import { playbookDirectory } from "#shared/playbook/index.ts";
import { runCli } from "@repo/config/cli";

import { listen, origin } from "./listen.ts";
import { resolveProject } from "./project.ts";

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

function configure(settings: Readonly<Record<string, string | undefined>>): void {
  for (const [name, value] of Object.entries(settings)) {
    if (value !== undefined) {
      // oxlint-disable-next-line node/no-process-env
      process.env[name] = value;
    }
  }
}

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

function startFailed(cause: unknown): Readonly<Record<string, unknown>> {
  return {
    cause: String(cause),
    event: "commander.start_failed",
    ok: false,
    remediation: `Check that ${origin} is free, that bd and claude are installed, and that the workspace was built (vp run @repo/commander#start builds first).`,
  };
}

const main = Effect.scoped(start()).pipe(Effect.provide(NodeServices.layer));

runCli(values.help ? help : main, startFailed);
