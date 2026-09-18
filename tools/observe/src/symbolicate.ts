// oxlint-disable-next-line import/no-nodejs-modules
import { fileURLToPath } from "node:url";
// oxlint-disable-next-line import/no-nodejs-modules
import { parseArgs } from "node:util";

import { NodeRuntime } from "@effect/platform-node";
import { Effect, Schema } from "effect";

import { applications } from "@template/config";

import { symbolicate } from "./source-maps.ts";

class SymbolicateFailure extends Schema.TaggedError<SymbolicateFailure>()("SymbolicateFailure", {
  reason: Schema.Literals(["arguments_invalid"]),
}) {}

const MAX_LOCATIONS = 20;

const SymbolicateInput = Schema.Struct({
  app: Schema.Literals(applications),
  locations: Schema.Array(Schema.String).check(Schema.isLengthBetween(1, MAX_LOCATIONS)),
  release: Schema.String.check(Schema.isPattern(/^[0-9a-f]{16}$/u)),
});

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    app: { type: "string" },
    help: { default: false, type: "boolean" },
    release: { type: "string" },
  },
});

const help = Effect.sync(() => {
  // oxlint-disable-next-line no-console
  console.info(
    JSON.stringify({
      locations: "error.locations lines from Workers Logs, such as /assets/index-abc.js:1:234",
      readOnly: true,
      usage: `vp run --filter @template/observe symbolicate --app <${applications.join("|")}> --release <APP_RELEASE> <location>...`,
    }),
  );
});

const resolveFrames = Effect.gen(function* resolveFrames() {
  const input = yield* Schema.decodeUnknownEffect(SymbolicateInput)({
    app: values.app,
    locations: positionals.flatMap((value) => value.split("\n")).filter(Boolean),
    release: values.release,
  }).pipe(Effect.mapError(() => new SymbolicateFailure({ reason: "arguments_invalid" })));
  const frames = yield* symbolicate(
    {
      app: input.app,
      release: input.release,
      repositoryRoot: fileURLToPath(new URL("../../../", import.meta.url)),
    },
    input.locations,
  );
  yield* Effect.sync(() => {
    // oxlint-disable-next-line no-console
    console.info(
      JSON.stringify({
        app: input.app,
        event: "observe.symbolicated",
        frames,
        release: input.release,
      }),
    );
  });
});

NodeRuntime.runMain(
  (values.help ? help : resolveFrames).pipe(
    Effect.catchCause(() =>
      Effect.sync(() => {
        // oxlint-disable-next-line no-console
        console.error(JSON.stringify({ event: "observe.symbolicate_failed" }));
        process.exitCode = 1;
      }),
    ),
  ),
  { disableErrorReporting: true },
);
