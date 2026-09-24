// @effect-diagnostics-next-line nodeBuiltinImport:off
import { rmSync } from "node:fs";

import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem } from "effect";
import { describe } from "vite-plus/test";

import { testLintRule } from "../../../../lint-rule-authoring/rule-tester-test-fixture.ts";
import { path } from "../../../../platform/path.ts";
import { noStandaloneTsconfig } from "./no-standalone-tsconfig--extend-shared-preset.ts";

const sharedPresets = ["dont-review-it/tsconfig/library.json", "dont-review-it/tsconfig/app.json"];

const fixtureDir = await Effect.gen(function* fixtureDirectory() {
  const filesystem = yield* FileSystem.FileSystem;
  return yield* filesystem.makeTempDirectory({ prefix: "dont-review-it-no-standalone-tsconfig-" });
}).pipe(Effect.provide(NodeServices.layer), Effect.runPromise);
const extendsLibrary = path.join(fixtureDir, "extends-library", "index.ts");
const extendsApp = path.join(fixtureDir, "extends-app", "index.ts");
const extendsRelative = path.join(fixtureDir, "extends-relative", "index.ts");
const extendsOwnPreset = path.join(fixtureDir, "extends-own-preset", "index.ts");
const extendsArray = path.join(fixtureDir, "extends-array", "index.ts");
const withComments = path.join(fixtureDir, "with-comments", "index.ts");
const forgotten = path.join(fixtureDir, "forgotten", "index.ts");
const standalone = path.join(fixtureDir, "standalone", "index.ts");
const extendsBase = path.join(fixtureDir, "extends-base", "index.ts");
const extendsForeignPreset = path.join(fixtureDir, "extends-foreign-preset", "index.ts");
const malformed = path.join(fixtureDir, "malformed", "index.ts");
const buriedUnderStandalone = path.join(fixtureDir, "standalone", "src", "deep", "index.ts");

const withoutAnyTsconfig = path.join(fixtureDir, "no-tsconfig-anywhere.ts");

const FIXTURE_DIRECTORIES: readonly string[] = [
  path.join(fixtureDir, "extends-library"),
  path.join(fixtureDir, "extends-app"),
  path.join(fixtureDir, "extends-relative"),
  path.join(fixtureDir, "extends-own-preset"),
  path.join(fixtureDir, "extends-array"),
  path.join(fixtureDir, "with-comments"),
  path.join(fixtureDir, "forgotten"),
  path.join(fixtureDir, "standalone"),
  path.join(fixtureDir, "extends-base"),
  path.join(fixtureDir, "extends-foreign-preset"),
  path.join(fixtureDir, "malformed"),
  path.join(fixtureDir, "standalone", "src", "deep"),
];

const FIXTURE_FILES: ReadonlyArray<readonly [string, string]> = [
  [
    path.join(fixtureDir, "extends-library", "tsconfig.json"),
    '{ "extends": "@repo/dont-review-it/tsconfig/library.json" }\n',
  ],
  [
    path.join(fixtureDir, "extends-app", "tsconfig.json"),
    '{ "extends": "@repo/dont-review-it/tsconfig/app.json" }\n',
  ],
  [
    path.join(fixtureDir, "extends-relative", "tsconfig.json"),
    '{ "extends": "../dont-review-it/tsconfig/library.json" }\n',
  ],
  [
    path.join(fixtureDir, "extends-own-preset", "tsconfig.json"),
    '{ "extends": "./tsconfig/library.json" }\n',
  ],
  [
    path.join(fixtureDir, "extends-array", "tsconfig.json"),
    '{ "extends": ["./local.json", "@repo/dont-review-it/tsconfig/library.json"] }\n',
  ],
  [
    path.join(fixtureDir, "with-comments", "tsconfig.json"),
    '{\n  /* Bundler mode */\n  "extends": "@repo/dont-review-it/tsconfig/app.json", // preset\n}\n',
  ],
  [
    path.join(fixtureDir, "forgotten", "tsconfig.json"),
    '{ "extends": "@repo/dont-review-it/tsconfig/library.json" }\n',
  ],
  [
    path.join(fixtureDir, "standalone", "tsconfig.json"),
    '{ "compilerOptions": { "strict": true, "noEmit": true } }\n',
  ],
  [
    path.join(fixtureDir, "extends-base", "tsconfig.json"),
    '{ "extends": "@repo/dont-review-it/tsconfig/base.json" }\n',
  ],
  [
    path.join(fixtureDir, "extends-foreign-preset", "tsconfig.json"),
    '{ "extends": "@tsconfig/node22/tsconfig.json" }\n',
  ],
  [path.join(fixtureDir, "malformed", "tsconfig.json"), "this is not a tsconfig at all\n"],
];

await Effect.gen(function* writeFixture() {
  const filesystem = yield* FileSystem.FileSystem;
  for (const directory of FIXTURE_DIRECTORIES) {
    yield* filesystem.makeDirectory(directory, { recursive: true });
  }
  for (const [filePath, content] of FIXTURE_FILES) {
    yield* filesystem.writeFileString(filePath, content);
  }
}).pipe(Effect.provide(NodeServices.layer), Effect.runPromise);

describe("dont-review-it/no-standalone-tsconfig--extend-shared-preset", () => {
  testLintRule(noStandaloneTsconfig, {
    valid: [
      {
        name: "without configured presets the rule inspects nothing",
        code: "export const total = 1;",
        filename: standalone,
      },
      {
        name: "an empty preset list inspects nothing",
        code: "export const total = 1;",
        filename: standalone,
        options: [[]],
      },
      {
        name: "extending the library preset by package name passes",
        code: "export const total = 1;",
        filename: extendsLibrary,
        options: [sharedPresets],
      },
      {
        name: "extending the app preset by package name passes",
        code: "export const total = 1;",
        filename: extendsApp,
        options: [sharedPresets],
      },
      {
        name: "extending the same preset by a relative path passes",
        code: "export const total = 1;",
        filename: extendsRelative,
        options: [sharedPresets],
      },
      {
        name: "one allowed preset among several extends entries passes",
        code: "export const total = 1;",
        filename: extendsArray,
        options: [sharedPresets],
      },
      {
        name: "comments and a trailing comma do not hide the extends entry",
        code: "export const total = 1;",
        filename: withComments,
        options: [sharedPresets],
      },
      {
        name: "the tsconfig above a file is looked up on disk",
        code: "export const total = 1;",
        filename: forgotten,
        options: [sharedPresets],
      },
      {
        name: "the answer is remembered, so removing the tsconfig afterwards does not change it",
        code: "export const total = 2;",
        filename: forgotten,
        options: [sharedPresets],
        before: () => {
          rmSync(path.join(fixtureDir, "forgotten", "tsconfig.json"));
        },
      },
      {
        name: "a file with no tsconfig above it is left alone",
        code: "export const total = 1;",
        filename: withoutAnyTsconfig,
        options: [sharedPresets],
      },
    ],
    invalid: [
      {
        name: "a tsconfig that writes its own compilerOptions is reported",
        documented: true,
        code: "export const total = 1;",
        filename: standalone,
        options: [sharedPresets],
        errors: [{ messageId: "standaloneTsconfig" }],
      },
      {
        name: "a file buried under a standalone tsconfig is reported too",
        code: "export const total = 1;",
        filename: buriedUnderStandalone,
        options: [sharedPresets],
        errors: [{ messageId: "standaloneTsconfig" }],
      },
      {
        name: "extending the shared base directly skips the layer that decides the runtime",
        code: "export const total = 1;",
        filename: extendsBase,
        options: [sharedPresets],
        errors: [{ messageId: "standaloneTsconfig" }],
      },
      {
        name: "extending a preset from somewhere else is not extending this one",
        code: "export const total = 1;",
        filename: extendsForeignPreset,
        options: [sharedPresets],
        errors: [{ messageId: "standaloneTsconfig" }],
      },
      {
        name: "a path that omits the package owning the preset does not say which preset it means",
        code: "export const total = 1;",
        filename: extendsOwnPreset,
        options: [sharedPresets],
        errors: [{ messageId: "standaloneTsconfig" }],
      },
      {
        name: "a tsconfig that cannot be read as JSON extends nothing",
        code: "export const total = 1;",
        filename: malformed,
        options: [sharedPresets],
        errors: [{ messageId: "standaloneTsconfig" }],
      },
    ],
  });
});
