import { Effect, Option, Predicate, Record as Rec, Schema, pipe } from "effect";

import { localBin, projectRoot, runHook } from "./env.ts";
import { ROOT, fallowConfigFiles } from "./fallow-config.ts";
import { HookPlatform } from "./platform.ts";

const JsonObject = Schema.Record(Schema.String, Schema.Unknown);

const ToolCall = Schema.Struct({
  method: Schema.Literal("tools/call"),
  params: JsonObject,
});

const ToolArguments = Schema.Struct({
  root: Schema.optional(Schema.String),
  config: Schema.optional(Schema.String),
});

const decodeMessage = Schema.decodeUnknownOption(Schema.fromJsonString(JsonObject));
const decodeObject = Schema.decodeUnknownOption(JsonObject);
const decodeToolCall = Schema.decodeUnknownOption(ToolCall);
const decodeArguments = Schema.decodeUnknownOption(ToolArguments);
const encodeMessage = Schema.encodeUnknownOption(Schema.fromJsonString(Schema.Unknown));

interface Injection {
  readonly root: string;
  readonly files: Readonly<Record<string, string>>;
  readonly relative: (from: string, to: string) => string;
  readonly resolve: (...segments: readonly string[]) => string;
}

const configFor = (injection: Injection, root: string | undefined): Option.Option<string> => {
  const directory = injection.relative(
    injection.root,
    injection.resolve(injection.root, root ?? ROOT),
  );
  return pipe(
    Rec.get(injection.files, directory || ROOT),
    Option.orElse(() => Rec.get(injection.files, ROOT)),
  );
};

const withConfig =
  (injection: Injection) =>
  (line: string): string =>
    pipe(
      decodeMessage(line),
      Option.flatMap((message) =>
        decodeToolCall(message).pipe(
          Option.flatMap(({ params }) => {
            const args = decodeObject(params["arguments"]).pipe(Option.getOrElse(() => ({})));
            return decodeArguments(args).pipe(
              Option.filter(({ config }) => Predicate.isUndefined(config)),
              Option.flatMap(({ root }) => configFor(injection, root)),
              Option.flatMap((config) =>
                encodeMessage({
                  ...message,
                  params: { ...params, arguments: { ...args, config } },
                }),
              ),
            );
          }),
        ),
      ),
      Option.getOrElse(() => line),
    );

runHook(
  Effect.gen(function* fallowMcp() {
    const platform = yield* HookPlatform;
    const root = yield* projectRoot;
    const files = yield* fallowConfigFiles;
    const fallow = yield* localBin("fallow");
    yield* platform.relay(
      fallow,
      ["mcp-server"],
      withConfig({
        root,
        files,
        relative: platform.relative,
        resolve: platform.resolve,
      }),
    );
  }).pipe(Effect.scoped),
);
