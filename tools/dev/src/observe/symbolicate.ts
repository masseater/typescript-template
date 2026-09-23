#!/usr/bin/env node
import { causeRecord, runCli } from "@repo/cli";
import { applications } from "@repo/config";
import { Console, Effect, Schema } from "effect";
import { Argument, Command, Flag } from "effect/unstable/cli";

import { layer, urlPath } from "../platform.ts";
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

const resolveFrames = Effect.fn("resolveFrames")(function* resolveFrames(input: {
  readonly app: (typeof applications)[number];
  readonly locations: readonly string[];
  readonly release: string;
}) {
  const decoded = yield* Schema.decodeEffect(SymbolicateInput)(input).pipe(
    Effect.mapError(() => new SymbolicateFailure({ reason: "arguments_invalid" })),
  );
  const repositoryRoot = yield* urlPath(new URL("../../../", import.meta.url));
  const frames = yield* symbolicate(
    {
      app: decoded.app,
      release: decoded.release,
      repositoryRoot,
    },
    decoded.locations,
  );
  yield* Console.info(
    yield* Schema.encodeEffect(
      Schema.fromJsonString(
        Schema.Struct({
          app: Schema.Literals(applications),
          event: Schema.Literal("observe.symbolicated"),
          frames: Schema.Unknown,
          release: Schema.String,
        }),
      ),
    )({
      app: decoded.app,
      event: "observe.symbolicated",
      frames,
      release: decoded.release,
    }),
  );
});

const symbolicateCommand = Command.make(
  "symbolicate",
  {
    app: Flag.Literals("app", applications).pipe(
      Flag.withDescription("Application to symbolicate"),
    ),
    locations: Argument.variadic(Argument.String("location")).pipe(
      Argument.withDescription("Workers log locations"),
    ),
    release: Flag.String("release").pipe(Flag.withDescription("Release id")),
  },
  Effect.fn(function* resolve({ app, locations, release }) {
    yield* resolveFrames({
      app,
      locations: locations.flatMap((value) => value.split("\n")).filter(Boolean),
      release,
    });
  }),
).pipe(
  Command.withDescription("Resolve Workers log locations through release source maps"),
  Command.run({ renderErrors: false, version: "0.0.0" }),
  Effect.provide(layer),
);

runCli(symbolicateCommand, (cause) => causeRecord("observe.symbolicate_failed", { cause }));
