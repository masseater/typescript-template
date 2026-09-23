import { NodeServices } from "@effect/platform-node";
import { describe, expect, layer } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";

import { runChecks } from "./run-checks.ts";

const ADOPTING_ONE_BUNDLE = `export default defineConfig({
  lint: dontReviewItPreset.lint({ bundles: ["testing"] }),
});
`;

const checksIn = ({
  files,
  skipped,
}: {
  readonly files: Readonly<Record<string, string>>;
  readonly skipped: (skippedReason: string | null) => boolean;
}) =>
  Effect.gen(function* checksIn() {
    const filesystem = yield* FileSystem.FileSystem;
    const paths = yield* Path.Path;
    const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({ prefix: "run-checks-" });
    for (const [relativePath, content] of Object.entries(files)) {
      const filePath = paths.join(repositoryRoot, relativePath);
      yield* filesystem.makeDirectory(paths.dirname(filePath), { recursive: true });
      yield* filesystem.writeFileString(filePath, content);
    }
    return runChecks(repositoryRoot)
      .outcomes.filter((ranCheck) => skipped(ranCheck.skippedReason))
      .map((ranCheck) => ranCheck.check);
  }).pipe(Effect.scoped);

const bundleNotAdopted = (skippedReason: string | null): boolean =>
  skippedReason === "bundle not adopted";

layer(NodeServices.layer)("runChecks", (it) => {
  describe("a repository naming one bundle", () => {
    it.effect("leaves every check of a bundle it never named unrun", () =>
      Effect.gen(function* program() {
        const skippedChecks = yield* checksIn({
          files: { "vite.config.ts": ADOPTING_ONE_BUNDLE },
          skipped: bundleNotAdopted,
        });
        expect(skippedChecks).toStrictEqual([
          "entry-composition",
          "canonical-values",
          "equivalent-concepts",
          "canonical-literal-types",
          "duplicated-bodies",
          "workflow-definitions",
          "action-updates",
          "lint-rule-index",
          "lint-rule-docs",
          "dependency-declarations",
          "required-file-form",
          "preset-adoption",
          "telemetry-wiring",
          "shippable-packages",
          "intent-skills",
        ]);
      }),
    );
  });

  describe("a repository whose toolchain configuration names no bundle", () => {
    it.effect("leaves no check unrun", () =>
      Effect.gen(function* program() {
        const skippedChecks = yield* checksIn({
          files: {
            "vite.config.ts": `export default defineConfig({ lint: dontReviewItPreset.lint({}) });\n`,
          },
          skipped: bundleNotAdopted,
        });
        expect(skippedChecks).toStrictEqual([]);
      }),
    );
  });

  describe("a repository carrying the files every check looks for", () => {
    it.effect("leaves no check unrun for want of what it reads", () =>
      Effect.gen(function* program() {
        const skippedChecks = yield* checksIn({
          files: {
            "package.json": `{ "name": "root" }\n`,
            "pnpm-workspace.yaml": "packages:\n  - packages/*\n",
            ".github/workflows/ci.yml": "name: ci\non: push\n",
            "vite.config.ts": `export default defineConfig({ lint: dontReviewItPreset.lint({ bundles: "all" }) });\n`,
          },
          skipped: (skippedReason) => skippedReason !== null,
        });
        expect(skippedChecks).toStrictEqual([]);
      }),
    );
  });

  describe("a repository whose workspace definition does not parse", () => {
    it.effect("leaves the checks that read it unrun", () =>
      Effect.gen(function* program() {
        const skippedChecks = yield* checksIn({
          files: { "pnpm-workspace.yaml": "packages:\n  - [\n" },
          skipped: (skippedReason) => skippedReason === "workspace definition does not parse",
        });
        expect(skippedChecks).toStrictEqual(["lint-rule-index", "lint-rule-docs"]);
      }),
    );
  });

  describe("a repository naming no bundle at all", () => {
    it.effect("leaves no check unrun", () =>
      Effect.gen(function* program() {
        const skippedChecks = yield* checksIn({ files: {}, skipped: bundleNotAdopted });
        expect(skippedChecks).toStrictEqual([]);
      }),
    );
  });
});
