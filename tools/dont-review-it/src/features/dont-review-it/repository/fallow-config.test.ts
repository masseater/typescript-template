import { NodeServices } from "@effect/platform-node";
import { repositoryRoot } from "@repo/config/repository-root";
import { Effect, FileSystem, Path, Schema } from "effect";
import { describe, expect, it } from "vite-plus/test";

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

const exclusionKeys = [
  "ignorePatterns",
  "ignoreDependencies",
  "ignoreDependencyOverrides",
  "ignoreExports",
  "ignoreFindings",
  "duplicates",
] as const;

const grantedExclusions: Readonly<Record<string, readonly string[]>> = {
  ".fallowrc.json": [
    "**/routeTree.gen.ts",
    "**/mockServiceWorker.js",
    "@effect/tsgo",
    "@scalar/api-reference",
    "@storybook/addon-mcp",
    "@tanstack/intent",
    "agent-browser",
    "oxc-transform-react",
    "playwright",
    "portless",
    "valibot",
    "zod-validation-error",
    "**/*",
    "default",
    "**/vite.config.ts",
  ],
  ".fallowrc.production.json": ["**", "!**/src/**"],
};

const exclusionsOf = (file: string): readonly string[] =>
  exclusionKeys.flatMap((key) => stringsIn(configOf(file)[key]));

const rulesTurnedOff = (file: string): readonly string[] => {
  const rules = configOf(file)["rules"];
  return typeof rules === "object" && rules !== null
    ? Object.entries(rules).flatMap(([rule, level]) => (level === "off" ? [rule] : []))
    : [];
};

describe("fallow configuration", () => {
  it.for(configFiles)("%s only shrinks its exclusions", (file) => {
    expect.hasAssertions();
    const granted = new Set(grantedExclusions[file] ?? []);
    expect(exclusionsOf(file).filter((value) => !granted.has(value))).toStrictEqual([]);
  });

  it.for(configFiles)("%s turns off no rule beyond the ones already off", (file) => {
    expect.hasAssertions();
    expect(
      rulesTurnedOff(file).filter(
        (rule) => rule !== "boundary-violation" && rule !== "policy-violation",
      ),
    ).toStrictEqual([]);
  });

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
