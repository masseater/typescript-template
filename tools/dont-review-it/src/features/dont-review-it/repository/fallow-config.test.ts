import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem, Path, Schema } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { repositoryRoot } from "./repository-root.ts";

const configFiles = [".fallowrc.json", ".fallowrc.production.json"] as const;

const FallowConfig = Schema.fromJsonString(Schema.Record(Schema.String, Schema.Unknown));

const configs = await Effect.runPromise(
  Effect.gen(function* fallowConfigs() {
    const filesystem = yield* FileSystem.FileSystem;
    const paths = yield* Path.Path;
    const entries = yield* Effect.forEach(configFiles, (file) =>
      Effect.map(
        Effect.flatMap(
          filesystem.readFileString(paths.join(repositoryRoot, file)),
          Schema.decodeEffect(FallowConfig),
        ),
        (config) => [file, config] as const,
      ),
    );
    return new Map<string, Readonly<Record<string, unknown>>>(entries);
  }).pipe(Effect.provide(NodeServices.layer)),
);

const configOf = (file: string): Readonly<Record<string, unknown>> => configs.get(file) ?? {};

const stringsIn = (value: unknown): readonly string[] => {
  if (typeof value === "string") {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.flatMap(stringsIn);
  }
  if (typeof value === "object" && value !== null) {
    return Object.values(value).flatMap(stringsIn);
  }
  return [];
};

const rootPatternsOf = (config: Readonly<Record<string, unknown>>): readonly string[] => [
  ...stringsIn(config["entry"]),
  ...stringsIn(config["dynamicallyLoaded"]),
  ...stringsIn(config["ignorePatterns"]),
  ...stringsIn(config["ignoreFindings"]),
  ...stringsIn(config["duplicates"]),
  ...(Array.isArray(config["overrides"]) ? config["overrides"] : []).flatMap((override: unknown) =>
    typeof override === "object" && override !== null && "files" in override
      ? stringsIn(override.files)
      : [],
  ),
  ...stringsIn(config["ignoreExports"]).filter((value) => value !== "default"),
];

describe("fallow configuration", () => {
  it.for(configFiles)("%s names no individual workspace", (file) => {
    expect.hasAssertions();
    expect(
      stringsIn(configOf(file)).filter((value) =>
        /(?:^|[!{,/])(?:apps|libs|tools|infra)\/(?![*{])/u.test(value),
      ),
    ).toStrictEqual([]);
  });

  it.for(configFiles)("%s matches root patterns at any depth", (file) => {
    expect.hasAssertions();
    expect(
      rootPatternsOf(configOf(file)).filter((pattern) => !/^!?(?:\*\*|\{)/u.test(pattern)),
    ).toStrictEqual([]);
  });
});
