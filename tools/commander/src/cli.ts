import { Console, Effect, Schema } from "effect";
import { HttpEffect, HttpServer, HttpServerRequest, HttpStaticServer } from "effect/unstable/http";
import { NodeHttpServer, NodeRuntime } from "@effect/platform-node";
// oxlint-disable-next-line import/no-nodejs-modules
import { createServer } from "node:http";
import { makeApp } from "./server.ts";
import open from "open";
// oxlint-disable-next-line import/no-nodejs-modules
import { parseArgs } from "node:util";
// oxlint-disable-next-line import/no-nodejs-modules
import path from "node:path";
import { reportFailed } from "./failure.ts";
import { resolveProject } from "./project.ts";

const host = "127.0.0.1";
const port = 3090;
const origin = `http://${host}:${port}`;
const workspace = path.dirname(import.meta.dirname);

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
      "--model <model passed to claude: defaults to the claude default>",
      "--no-open: do not open the browser",
    ],
    serves: origin,
  }),
);

const listen = Effect.fn("listen")(function* listen(
  handle: (request: Request) => Promise<Response>,
) {
  const files = yield* HttpStaticServer.make({ root: path.join(workspace, "dist"), spa: true });
  const api = HttpEffect.fromWebHandler(handle);
  const route = HttpServerRequest.HttpServerRequest.pipe(
    Effect.flatMap((request) => (request.url.startsWith("/api/") ? api : files)),
  );
  yield* HttpServer.serveEffect(route);
});

const serve = Effect.fn("serve")(function* serve() {
  const input = yield* Schema.decodeUnknownEffect(Input)({
    directory: positionals[0],
    model: values.model,
  });
  const project = yield* resolveProject(input.directory, process.cwd());
  const app = yield* makeApp({
    ...project,
    executable: "claude",
    model: input.model,
    origin,
  });
  yield* listen(async (request) => app.fetch(request));
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

const main = Effect.scoped(serve()).pipe(
  Effect.provide(NodeHttpServer.layer(createServer, { host, port })),
  Effect.catchCause((cause) => startFailed(cause)),
);

NodeRuntime.runMain(values.help ? help : main, { disableErrorReporting: true });
