import { Console, Effect, Schema } from "effect";
import { NodeRuntime } from "@effect/platform-node";
import { applications } from "@repo/config";
// oxlint-disable-next-line import/no-nodejs-modules
import { fileURLToPath } from "node:url";
// oxlint-disable-next-line import/no-nodejs-modules
import { parseArgs } from "node:util";
import { reportFailed } from "./failure.ts";
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

const help = Console.info(
  JSON.stringify({
    locations: "error.locations lines from Workers Logs, such as /assets/index-abc.js:1:234",
    readOnly: true,
    usage: `vp run --filter @repo/observe symbolicate --app <${applications.join("|")}> --release <APP_RELEASE> <location>...`,
  }),
);

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
  yield* Console.info(
    JSON.stringify({
      app: input.app,
      event: "observe.symbolicated",
      frames,
      release: input.release,
    }),
  );
});

NodeRuntime.runMain(
  (values.help ? help : resolveFrames).pipe(
    Effect.catchCause(() => reportFailed({ event: "observe.symbolicate_failed" })),
  ),
  { disableErrorReporting: true },
);
