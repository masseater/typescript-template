import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";
import { describe, expect } from "vite-plus/test";

import { buildBodyIndex, duplicatedClustersIn } from "./body-index.ts";
import { declarationsIn } from "./declarations.ts";
import { separatedByPrivateBindings } from "./private-bindings.ts";

const RUN = `export const run = (value: number): number => {
  const doubled = helper(value) * limit;
  return doubled * 2;
};
`;

const HERE = `import { fileURLToPath } from "node:url";

export const here = fileURLToPath(new URL("./plugin.ts", import.meta.url));
`;

const VERBOSE = `export const verbose = (value: number): boolean => {
  const shown = import.meta.env.DEV && value > limit;
  return shown === true;
};
`;

const TYPED_RUN = `export const run = (value: Input): Output => {
  const doubled = helper(value) * 2;
  return doubled satisfies Output;
};
`;

const OWN_TYPES = "export type Input = number;\nexport type Output = number;\n";

const OTHER_TYPES = "export type Input = 1 | 2;\nexport type Output = 2 | 4;\n";

const OWN_HELPER = `export const helper = (value: number): number => value + 1;

export const limit = 2;
`;

const OTHER_HELPER = `export const helper = (value: number): number => value - 1;

export const limit = 3;
`;

const MANIFEST = '{ "name": "workspace", "imports": { "#*": "./src/*" } }\n';

const clustersAmong = (sources: Readonly<Record<string, string>>) =>
  Effect.gen(function* duplicatedSites() {
    const filesystem = yield* FileSystem.FileSystem;
    const paths = yield* Path.Path;
    const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
      prefix: "duplicated-bodies-private-bindings-",
    });
    yield* Effect.forEach(Object.entries(sources), ([relativePath, source]) =>
      Effect.gen(function* written() {
        const absolutePath = paths.join(repositoryRoot, relativePath);
        yield* filesystem.makeDirectory(paths.dirname(absolutePath), { recursive: true });
        yield* filesystem.writeFileString(absolutePath, source);
      }),
    );
    const files = Object.entries(sources)
      .filter(([relativePath]) => relativePath.endsWith(".ts"))
      .map(([relativePath, source]) => ({ relativePath, bodies: declarationsIn(source) }))
      .map(({ relativePath, bodies }) => ({
        relativePath,
        bodies: bodies.map((declaration) => ({
          ...declaration,
          fingerprint: declaration.structure,
        })),
      }));
    return duplicatedClustersIn(
      buildBodyIndex(separatedByPrivateBindings({ repositoryRoot, files })),
    ).map((sites) => sites.map((site) => `${site.relativePath}:${site.name}`));
  });

layer(NodeServices.layer)("separatedByPrivateBindings", (it) => {
  describe("two packages calling helpers each keeps next to its own body", () => {
    const fixture = clustersAmong({
      "first/package.json": MANIFEST,
      "first/src/run.ts": `import { helper, limit } from "./helper.ts";\n\n${RUN}`,
      "first/src/helper.ts": OWN_HELPER,
      "second/package.json": MANIFEST,
      "second/src/run.ts": `import { helper, limit } from "./helper.ts";\n\n${RUN}`,
      "second/src/helper.ts": OTHER_HELPER,
    });

    it.effect("keeps the two bodies apart", () =>
      Effect.gen(function* program() {
        expect(yield* fixture).toStrictEqual([]);
      }),
    );
  });

  describe("two packages reaching their own helpers through their subpath imports", () => {
    const fixture = clustersAmong({
      "first/package.json": MANIFEST,
      "first/src/run.ts": `import { helper, limit } from "#helper.ts";\n\n${RUN}`,
      "first/src/helper.ts": OWN_HELPER,
      "second/package.json": MANIFEST,
      "second/src/run.ts": `import { helper, limit } from "#helper.ts";\n\n${RUN}`,
      "second/src/helper.ts": OTHER_HELPER,
    });

    it.effect("keeps the two bodies apart", () =>
      Effect.gen(function* program() {
        expect(yield* fixture).toStrictEqual([]);
      }),
    );
  });

  describe("two files reaching the same helper through different relative paths", () => {
    const fixture = clustersAmong({
      "first/package.json": MANIFEST,
      "first/src/run.ts": `import { helper, limit } from "./helper.ts";\n\n${RUN}`,
      "first/src/nested/run.ts": `import { helper, limit } from "../helper.ts";\n\n${RUN}`,
      "first/src/helper.ts": OWN_HELPER,
    });

    it.effect("reports the two bodies as one duplicate", () =>
      Effect.gen(function* program() {
        expect(yield* fixture).toStrictEqual([
          ["first/src/nested/run.ts:run", "first/src/run.ts:run"],
        ]);
      }),
    );
  });

  describe("two packages importing the helpers from the same shared package", () => {
    const fixture = clustersAmong({
      "first/package.json": MANIFEST,
      "first/src/run.ts": `import { helper, limit } from "shared-helpers";\n\n${RUN}`,
      "second/package.json": MANIFEST,
      "second/src/run.ts": `import { helper, limit } from "shared-helpers";\n\n${RUN}`,
    });

    it.effect("reports the two bodies as one duplicate", () =>
      Effect.gen(function* program() {
        expect(yield* fixture).toStrictEqual([["first/src/run.ts:run", "second/src/run.ts:run"]]);
      }),
    );
  });

  describe("one side importing privately a module that forwards the shared package the other imports", () => {
    const fixture = clustersAmong({
      "first/package.json": MANIFEST,
      "first/src/run.ts": `import { helper, limit } from "./helper.ts";\n\n${RUN}`,
      "first/src/helper.ts": 'export { helper, limit } from "shared-helpers";\n',
      "second/package.json": MANIFEST,
      "second/src/run.ts": `import { helper, limit } from "shared-helpers";\n\n${RUN}`,
    });

    it.effect("reports the two bodies as one duplicate", () =>
      Effect.gen(function* program() {
        expect(yield* fixture).toStrictEqual([["first/src/run.ts:run", "second/src/run.ts:run"]]);
      }),
    );
  });

  describe("one side importing privately helpers it defines while the other imports a shared package", () => {
    const fixture = clustersAmong({
      "first/package.json": MANIFEST,
      "first/src/run.ts": `import { helper, limit } from "./helper.ts";\n\n${RUN}`,
      "first/src/helper.ts": OWN_HELPER,
      "second/package.json": MANIFEST,
      "second/src/run.ts": `import { helper, limit } from "shared-helpers";\n\n${RUN}`,
    });

    it.effect("keeps the two bodies apart", () =>
      Effect.gen(function* program() {
        expect(yield* fixture).toStrictEqual([]);
      }),
    );
  });

  describe("one side importing a helper privately while the other declares it in its own module", () => {
    const fixture = clustersAmong({
      "first/package.json": MANIFEST,
      "first/src/run.ts": `import { helper, limit } from "./helper.ts";\n\n${RUN}`,
      "first/src/helper.ts": OWN_HELPER,
      "second/package.json": MANIFEST,
      "second/src/run.ts": `import { limit } from "./helper.ts";\n\nconst helper = (value: number): number => value * 3;\n\n${RUN}`,
      "second/src/helper.ts": OTHER_HELPER,
    });

    it.effect("reports the two bodies as one duplicate", () =>
      Effect.gen(function* program() {
        expect(yield* fixture).toStrictEqual([["first/src/run.ts:run", "second/src/run.ts:run"]]);
      }),
    );
  });

  describe("two packages reading the same build-time setting through import.meta", () => {
    const fixture = clustersAmong({
      "first/package.json": MANIFEST,
      "first/src/verbose.ts": `import { limit } from "shared-helpers";\n\n${VERBOSE}`,
      "second/package.json": MANIFEST,
      "second/src/verbose.ts": `import { limit } from "shared-helpers";\n\n${VERBOSE}`,
    });

    it.effect("reports the two bodies as one duplicate", () =>
      Effect.gen(function* program() {
        expect(yield* fixture).toStrictEqual([
          ["first/src/verbose.ts:verbose", "second/src/verbose.ts:verbose"],
        ]);
      }),
    );
  });

  describe("two packages annotating a shared helper call with types each declares", () => {
    const fixture = clustersAmong({
      "first/package.json": MANIFEST,
      "first/src/run.ts": `import { helper } from "shared-helpers";\n\nimport type { Input, Output } from "./types.ts";\n\n${TYPED_RUN}`,
      "first/src/types.ts": OWN_TYPES,
      "second/package.json": MANIFEST,
      "second/src/run.ts": `import { helper } from "shared-helpers";\n\nimport type { Input, Output } from "./types.ts";\n\n${TYPED_RUN}`,
      "second/src/types.ts": OTHER_TYPES,
    });

    it.effect("reports the two bodies as one duplicate", () =>
      Effect.gen(function* program() {
        expect(yield* fixture).toStrictEqual([["first/src/run.ts:run", "second/src/run.ts:run"]]);
      }),
    );
  });

  describe("two modules resolving a path next to their own file", () => {
    const fixture = clustersAmong({
      "first/package.json": MANIFEST,
      "first/src/here.ts": HERE,
      "second/package.json": MANIFEST,
      "second/src/here.ts": HERE,
    });

    it.effect("keeps the two bodies apart", () =>
      Effect.gen(function* program() {
        expect(yield* fixture).toStrictEqual([]);
      }),
    );
  });
});
