import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { NodeRuntime } from "@effect/platform-node";
import { applications } from "@template/config";
import { Effect, Schema } from "effect";
import { symbolicate } from "./source-maps.ts";

class SymbolicateFailure extends Schema.TaggedError<SymbolicateFailure>()("SymbolicateFailure", {
  reason: Schema.Literals(["arguments_invalid"]),
}) {}

const SymbolicateInput = Schema.Struct({
  app: Schema.Literals(applications),
  release: Schema.String.check(Schema.isPattern(/^[0-9a-f]{16}$/)),
  locations: Schema.Array(Schema.String).check(Schema.isLengthBetween(1, 20)),
});

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    app: { type: "string" },
    release: { type: "string" },
    help: { type: "boolean", default: false },
  },
});

const help = Effect.sync(() =>
  console.info(
    JSON.stringify({
      usage: `vp run --filter @template/observe symbolicate --app <${applications.join("|")}> --release <APP_RELEASE> <location>...`,
      locations: "error.locations lines from Workers Logs, such as /assets/index-abc.js:1:234",
      readOnly: true,
    }),
  ),
);

const resolveFrames = Effect.gen(function* () {
  const input = yield* Schema.decodeUnknownEffect(SymbolicateInput)({
    app: values.app,
    release: values.release,
    locations: positionals.flatMap((value) => value.split("\n")).filter(Boolean),
  }).pipe(Effect.mapError(() => new SymbolicateFailure({ reason: "arguments_invalid" })));
  const frames = yield* symbolicate(
    fileURLToPath(new URL("../../../", import.meta.url)),
    input.app,
    input.release,
    input.locations,
  );
  yield* Effect.sync(() =>
    console.info(
      JSON.stringify({
        event: "observe.symbolicated",
        app: input.app,
        release: input.release,
        frames,
      }),
    ),
  );
});

NodeRuntime.runMain(
  (values.help ? help : resolveFrames).pipe(
    Effect.catchCause(() =>
      Effect.sync(() => {
        console.error(JSON.stringify({ event: "observe.symbolicate_failed" }));
        process.exitCode = 1;
      }),
    ),
  ),
  { disableErrorReporting: true },
);
