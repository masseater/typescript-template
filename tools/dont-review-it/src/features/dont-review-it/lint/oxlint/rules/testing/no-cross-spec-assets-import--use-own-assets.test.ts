import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { testLintRule } from "../../../../lint-rule-authoring/index.ts";
import { path } from "../../../../platform/path.ts";
import { noCrossSpecAssetsImport } from "./no-cross-spec-assets-import--use-own-assets.ts";

const fixtureDir = await Effect.gen(function* fixtureDirectory() {
  const filesystem = yield* FileSystem.FileSystem;
  return yield* filesystem.realPath(
    yield* filesystem.makeTempDirectory({ prefix: "dont-review-it-no-cross-spec-assets-import-" }),
  );
}).pipe(Effect.provide(NodeServices.layer), Effect.runPromise);

const optionsSchema = noCrossSpecAssetsImport.meta.schema;

const FIXTURE_DIRECTORIES: readonly string[] = [
  path.join(fixtureDir, "owner"),
  path.join(fixtureDir, "other"),
  path.join(fixtureDir, "packages/shared/src"),
  path.join(fixtureDir, "node_modules/@fixture"),
  path.join(fixtureDir, "node_modules/outside-pkg"),
  path.join(fixtureDir, "aliased/values"),
  path.join(fixtureDir, "inherited"),
  path.join(fixtureDir, "values"),
];

const FIXTURE_FILES: ReadonlyArray<readonly [string, string]> = [
  [path.join(fixtureDir, "pnpm-workspace.yaml"), "packages:\n  - packages/*\n"],
  [path.join(fixtureDir, "owner/order.assets.ts"), "export const rows = [1, 2];\n"],
  [path.join(fixtureDir, "owner/order.test.ts"), ""],
  [path.join(fixtureDir, "owner/plain.ts"), "export const total = 1;\n"],
  [path.join(fixtureDir, "owner/relay.ts"), 'export * from "./order.assets.ts";\n'],
  [path.join(fixtureDir, "owner/named-relay.ts"), 'export { rows } from "./order.assets.ts";\n'],
  [path.join(fixtureDir, "owner/deep-relay.ts"), 'export * from "./relay.ts";\n'],
  [
    path.join(fixtureDir, "owner/plain-relay.ts"),
    'import { rows } from "./order.assets.ts";\nexport { rows };\n',
  ],
  [path.join(fixtureDir, "other/order.assets.ts"), "export const rows = [3];\n"],
  [
    path.join(fixtureDir, "packages/shared/package.json"),
    JSON.stringify({
      name: "@fixture/shared",
      exports: { ".": "./src/index.ts", "./data": "./src/table.assets.ts" },
    }),
  ],
  [path.join(fixtureDir, "packages/shared/src/index.ts"), "export const shared = 1;\n"],
  [path.join(fixtureDir, "packages/shared/src/table.assets.ts"), "export const table = [4];\n"],
  [
    path.join(fixtureDir, "node_modules/outside-pkg/package.json"),
    JSON.stringify({ name: "outside-pkg", exports: { "./data": "./order.assets.ts" } }),
  ],
  [path.join(fixtureDir, "node_modules/outside-pkg/order.assets.ts"), "export const rows = [5];\n"],
  [
    path.join(fixtureDir, "aliased/tsconfig.json"),
    JSON.stringify({ compilerOptions: { baseUrl: ".", paths: { "@data/*": ["./values/*"] } } }),
  ],
  [path.join(fixtureDir, "aliased/values/order.assets.ts"), "export const rows = [6];\n"],
  [
    path.join(fixtureDir, "inherited/tsconfig.json"),
    JSON.stringify({ extends: "./tsconfig.base.json" }),
  ],
  [
    path.join(fixtureDir, "inherited/tsconfig.base.json"),
    JSON.stringify({
      compilerOptions: { paths: { "@shared/values": ["../values/order.assets.ts"] } },
    }),
  ],
  [path.join(fixtureDir, "values/order.assets.ts"), "export const rows = [7];\n"],
];

const FIXTURE_LINKS: ReadonlyArray<readonly [string, string]> = [
  [path.join(fixtureDir, "packages/shared"), path.join(fixtureDir, "node_modules/@fixture/shared")],
];

await Effect.gen(function* writeFixture() {
  const filesystem = yield* FileSystem.FileSystem;
  for (const directory of FIXTURE_DIRECTORIES) {
    yield* filesystem.makeDirectory(directory, { recursive: true });
  }
  for (const [filePath, content] of FIXTURE_FILES) {
    yield* filesystem.writeFileString(filePath, content);
  }
  for (const [target, link] of FIXTURE_LINKS) {
    yield* filesystem.symlink(target, link);
  }
}).pipe(Effect.provide(NodeServices.layer), Effect.runPromise);

describe("dont-review-it/no-cross-spec-assets-import--use-own-assets", () => {
  testLintRule(noCrossSpecAssetsImport, {
    valid: [
      {
        name: "the spec of the same stem in the same directory owns the test data it reads",
        code: 'import { rows } from "./order.assets.ts";',
        filename: path.join(fixtureDir, "owner/order.test.ts"),
      },
      {
        name: "the owner is recognised through a specifier that carries no extension",
        documented: true,
        code: 'import { rows } from "./order.assets";',
        filename: path.join(fixtureDir, "owner/order.test.ts"),
      },
      {
        name: "the owner is recognised through a specifier spelled with the built extension",
        code: 'import { rows } from "./order.assets.js";',
        filename: path.join(fixtureDir, "owner/order.test.ts"),
      },
      {
        name: "a module that is not test data is read by anyone",
        code: 'import { total } from "./plain.ts";',
        filename: path.join(fixtureDir, "owner/checkout.test.ts"),
      },
      {
        name: "test data inside an installed dependency is out of reach of this invariant",
        code: 'import { rows } from "outside-pkg/data";',
        filename: path.join(fixtureDir, "owner/checkout.test.ts"),
      },
      {
        name: "a specifier that resolves to nothing carries no coupling",
        code: 'import { rows } from "nowhere-at-all";',
        filename: path.join(fixtureDir, "owner/checkout.test.ts"),
      },
      {
        name: "a specifier decided at run time cannot be followed to a file",
        code: "export const load = (name: string) => import(name);",
        filename: path.join(fixtureDir, "owner/checkout.test.ts"),
      },
      {
        name: "an export list without a source names no module",
        code: "const rows = [1];\nexport { rows };",
        filename: path.join(fixtureDir, "owner/checkout.test.ts"),
      },
      {
        name: "a call that is not a module request is left alone",
        code: 'export const total = Number.parseInt("1", 10);',
        filename: path.join(fixtureDir, "owner/checkout.test.ts"),
      },
      {
        name: "test data reading test data is left to the rule that forbids its imports outright",
        code: 'import { rows } from "../other/order.assets.ts";',
        filename: path.join(fixtureDir, "owner/order.assets.ts"),
      },
    ],
    invalid: [
      {
        name: "another spec in the same directory is not the owner",
        documented: true,
        code: 'import { rows } from "./order.assets.ts";',
        filename: path.join(fixtureDir, "owner/checkout.test.ts"),
        errors: [
          {
            messageId: "crossSpecAssetsImport",
            data: {
              specifier: "./order.assets.ts",
              assetsPath: "owner/order.assets.ts",
              ownStem: "checkout",
            },
          },
        ],
      },
      {
        name: "a spec of the same stem in another directory is not the owner",
        code: 'import { rows } from "../owner/order.assets.ts";',
        filename: path.join(fixtureDir, "other/order.test.ts"),
        errors: [
          {
            messageId: "crossSpecAssetsImport",
            data: {
              specifier: "../owner/order.assets.ts",
              assetsPath: "owner/order.assets.ts",
              ownStem: "order",
            },
          },
        ],
      },
      {
        name: "a module that is no spec at all is reported on its own message",
        code: 'import { rows } from "./order.assets.ts";',
        filename: path.join(fixtureDir, "owner/plain.ts"),
        errors: [
          {
            messageId: "foreignAssetsImport",
            data: { specifier: "./order.assets.ts", assetsPath: "owner/order.assets.ts" },
          },
        ],
      },
      {
        name: "a type-only import is a reader of the file all the same",
        code: 'import type { rows } from "./order.assets.ts";',
        filename: path.join(fixtureDir, "owner/checkout.test.ts"),
        errors: [{ messageId: "crossSpecAssetsImport" }],
      },
      {
        name: "an import that binds nothing still couples this file to the data",
        code: 'import "./order.assets.ts";',
        filename: path.join(fixtureDir, "owner/checkout.test.ts"),
        errors: [{ messageId: "crossSpecAssetsImport" }],
      },
      {
        name: "a named re-export reaches the data as much as an import does",
        code: 'export { rows } from "./order.assets.ts";',
        filename: path.join(fixtureDir, "owner/checkout.test.ts"),
        errors: [{ messageId: "crossSpecAssetsImport" }],
      },
      {
        name: "a star re-export reaches the data as much as an import does",
        code: 'export * from "./order.assets.ts";',
        filename: path.join(fixtureDir, "owner/checkout.test.ts"),
        errors: [{ messageId: "crossSpecAssetsImport" }],
      },
      {
        name: "a file that forwards the data is followed through to what it forwards",
        documented: true,
        code: 'import { rows } from "./relay.ts";',
        filename: path.join(fixtureDir, "owner/checkout.test.ts"),
        errors: [
          {
            messageId: "crossSpecAssetsImport",
            data: {
              specifier: "./relay.ts",
              assetsPath: "owner/order.assets.ts",
              ownStem: "checkout",
            },
          },
        ],
      },
      {
        name: "a named forward is followed as well as a star forward",
        code: 'import { rows } from "./named-relay.ts";',
        filename: path.join(fixtureDir, "owner/checkout.test.ts"),
        errors: [{ messageId: "crossSpecAssetsImport" }],
      },
      {
        name: "forwarding through a second file changes nothing",
        code: 'import { rows } from "./deep-relay.ts";',
        filename: path.join(fixtureDir, "owner/checkout.test.ts"),
        errors: [{ messageId: "crossSpecAssetsImport" }],
      },
      {
        name: "a specifier bound to a constant in this file is decided before the run",
        code: 'const held = "./order.assets.ts";\nexport const loaded = import(held);',
        filename: path.join(fixtureDir, "owner/checkout.test.ts"),
        errors: [{ messageId: "crossSpecAssetsImport" }],
      },
      {
        name: "a specifier assembled from static parts is decided before the run",
        code: 'const stem = "order";\nexport const loaded = import(`./${stem}.assets.ts`);',
        filename: path.join(fixtureDir, "owner/checkout.test.ts"),
        errors: [{ messageId: "crossSpecAssetsImport" }],
      },
      {
        name: "a synchronous module request reaches the data as much as an import does",
        code: 'export const rows = require("./order.assets.ts");',
        filename: path.join(fixtureDir, "owner/checkout.test.ts"),
        errors: [{ messageId: "crossSpecAssetsImport" }],
      },
      {
        name: "a package specifier that lands on test data through a declared entry is followed",
        code: 'import { table } from "@fixture/shared/data";',
        filename: path.join(fixtureDir, "owner/checkout.test.ts"),
        errors: [
          {
            messageId: "crossSpecAssetsImport",
            data: {
              specifier: "@fixture/shared/data",
              assetsPath: "packages/shared/src/table.assets.ts",
              ownStem: "checkout",
            },
          },
        ],
      },
      {
        name: "a package specifier that reaches past the declared entries is followed too",
        code: 'import { table } from "@fixture/shared/src/table.assets.ts";',
        filename: path.join(fixtureDir, "owner/checkout.test.ts"),
        errors: [{ messageId: "crossSpecAssetsImport" }],
      },
      {
        name: "a path alias declared for the project is followed to what it stands for",
        code: 'import { rows } from "@data/order.assets.ts";',
        filename: path.join(fixtureDir, "aliased/reader.test.ts"),
        errors: [
          {
            messageId: "crossSpecAssetsImport",
            data: {
              specifier: "@data/order.assets.ts",
              assetsPath: "aliased/values/order.assets.ts",
              ownStem: "reader",
            },
          },
        ],
      },
      {
        name: "a path alias declared in a configuration this project extends is followed as well",
        code: 'import { rows } from "@shared/values";',
        filename: path.join(fixtureDir, "inherited/reader.test.ts"),
        errors: [
          {
            messageId: "crossSpecAssetsImport",
            data: {
              specifier: "@shared/values",
              assetsPath: "values/order.assets.ts",
              ownStem: "reader",
            },
          },
        ],
      },
      {
        name: "the spelling of test data is replaced by the one the repository configures",
        code: 'import { rows } from "./order.assets.ts";',
        filename: path.join(fixtureDir, "owner/checkout.spec.ts"),
        options: [{ assetsNameMarkers: ["assets"], specFileSuffixes: [".spec.ts"] }],
        errors: [
          {
            messageId: "crossSpecAssetsImport",
            data: {
              specifier: "./order.assets.ts",
              assetsPath: "owner/order.assets.ts",
              ownStem: "checkout",
            },
          },
        ],
      },
    ],
  });

  it("the options schema declares the two naming vocabularies and refuses any other key", () => {
    expect(optionsSchema).toStrictEqual([
      {
        type: "object",
        properties: {
          assetsNameMarkers: { type: "array", items: { type: "string" } },
          specFileSuffixes: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ]);
  });
});
