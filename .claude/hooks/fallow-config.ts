import { Effect, Option, Record as Rec, Schema, pipe } from "effect";
import type { Scope } from "effect";
import { fallow } from "typescript-template/fallow.config.ts";

import { HookPlatform } from "./platform.ts";

const ROOT = ".";

type FallowConfig = Readonly<Record<string, unknown>>;

const featureSliced = {
  ...fallow,
  boundaries: { preset: "feature-sliced", zones: [], rules: [] },
};

const fallowConfigs: Readonly<Record<string, FallowConfig>> = {
  [ROOT]: fallow,
  "apps/web": featureSliced,
  "apps/lp": featureSliced,
  ".claude": {
    ...fallow,
    entry: ["hooks/*.ts"],
    includeEntryExports: true,
    ignorePatterns: ["skills/**"],
    boundaries: { zones: [], rules: [] },
  },
};

const encodeJson = Schema.encodeUnknownEffect(Schema.fromJsonString(Schema.Unknown));

const writeConfig = (
  config: FallowConfig,
): Effect.Effect<string, never, HookPlatform | Scope.Scope> =>
  Effect.gen(function* write() {
    const platform = yield* HookPlatform;
    const text = yield* encodeJson(config).pipe(Effect.orDie);
    return yield* platform.writeTempFile(".fallowrc.json", text);
  });

const fallowConfigFile = (
  directory: string,
): Effect.Effect<Option.Option<string>, never, HookPlatform | Scope.Scope> =>
  Rec.get(fallowConfigs, directory).pipe(
    Option.match({
      onNone: () => Effect.succeedNone,
      onSome: (config) => Effect.asSome(writeConfig(config)),
    }),
  );

const fallowConfigFiles: Effect.Effect<
  Readonly<Record<string, string>>,
  never,
  HookPlatform | Scope.Scope
> = Effect.all(
  pipe(
    fallowConfigs,
    Rec.map((config) => writeConfig(config)),
  ),
);

export { ROOT, fallowConfigFile, fallowConfigFiles };
