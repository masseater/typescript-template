import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";
import { expect } from "vite-plus/test";

import { defaultPresetAdoptionConfig } from "../src/features/dont-review-it/preset-adoption/config.ts";
import { runPresetAdoptionChecks } from "../src/features/dont-review-it/preset-adoption/run-preset-adoption-checks.ts";

const config = defaultPresetAdoptionConfig;

const WORKSPACES = {
  "package.json": `{"spelled": "root"}`,
  "packages/left/package.json": `{"spelled": "left"}`,
  "packages/right/package.json": `{"spelled": "right"}`,
};

const repositoryWith = (files: Readonly<Record<string, string>>) =>
  Effect.gen(function* repositoryWith() {
    const filesystem = yield* FileSystem.FileSystem;
    const paths = yield* Path.Path;
    const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
      prefix: "dont-review-it-preset-adoption-",
    });
    yield* Effect.forEach(
      Object.entries(files),
      ([spelled, source]) =>
        Effect.gen(function* writeFixture() {
          const checked = paths.join(repositoryRoot, spelled);
          yield* filesystem.makeDirectory(paths.dirname(checked), { recursive: true });
          yield* filesystem.writeFileString(checked, source);
        }),
      { discard: true },
    );
    return repositoryRoot;
  });

layer(NodeServices.layer)("preset の適用範囲の検査", (it) => {
  it.effect("すべてのワークスペースが preset の下にある設定を黙って通す", () =>
    Effect.gen(function* program() {
      const repositoryRoot = yield* repositoryWith({
        ...WORKSPACES,
        "vite.config.ts": `export default defineConfig({ lint: { rules: {} } });`,
      });

      expect(runPresetAdoptionChecks({ repositoryRoot, config }).warnings).toStrictEqual([]);
    }),
  );

  it.effect(
    "preset のルールを止めている override を、届かなくなったワークスペースごとに挙げて報告する",
    () =>
      Effect.gen(function* program() {
        const repositoryRoot = yield* repositoryWith({
          ...WORKSPACES,
          "vite.config.ts": `export default defineConfig({
  lint: {
    overrides: [
      {
        files: ["packages/left/**"],
        rules: { "dont-review-it/no-reassign--use-spread-or-iife": "off" },
      },
    ],
  },
});`,
        });

        const { warnings } = runPresetAdoptionChecks({ repositoryRoot, config });

        expect(warnings.map((warning) => warning.message)).toStrictEqual([
          "The lint configuration must not leave dont-review-it/no-reassign--use-spread-or-iife switched off for packages/left. Delete the override and repair what it reports, or record in an engineering decision log why the rule cannot reach there.",
        ]);
      }),
  );

  it.effect(
    "パスを絞らずに止めたルールは、すべてのワークスペースに届かないものとして報告する",
    () =>
      Effect.gen(function* program() {
        const repositoryRoot = yield* repositoryWith({
          ...WORKSPACES,
          "vite.config.ts": `export default defineConfig({
  lint: { rules: { "dont-review-it/no-reassign--use-spread-or-iife": "off" } },
});`,
        });

        expect(runPresetAdoptionChecks({ repositoryRoot, config }).warnings).toHaveLength(2);
      }),
  );

  it.effect("preset の外のルールを止めても報告しない", () =>
    Effect.gen(function* program() {
      const repositoryRoot = yield* repositoryWith({
        ...WORKSPACES,
        "vite.config.ts": `export default defineConfig({
  lint: { rules: { "vitest/consistent-test-filename": "off" } },
});`,
      });

      expect(runPresetAdoptionChecks({ repositoryRoot, config }).warnings).toStrictEqual([]);
    }),
  );

  it.effect(
    "採っていない束のルールを止めている override は、何も止めていないものとして報告する",
    () =>
      Effect.gen(function* program() {
        const repositoryRoot = yield* repositoryWith({
          ...WORKSPACES,
          "vite.config.ts": `export default defineConfig({
  lint: dontReviewItPreset.lint({
    bundles: ["testing"],
    rules: { "dont-review-it/no-reassign--use-spread-or-iife": "off" },
  }),
});`,
        });

        const { warnings } = runPresetAdoptionChecks({ repositoryRoot, config });

        expect(warnings.map((warning) => warning.message)).toStrictEqual([
          "The lint configuration must not switch dont-review-it/no-reassign--use-spread-or-iife off while it does not carry the mutation-and-failure bundle, because the override stops nothing. Delete the override, or name that bundle where the preset is called.",
        ]);
      }),
  );

  it.effect("ツールチェーンの設定が無いリポジトリでは適用範囲を検査しない", () =>
    Effect.gen(function* program() {
      const repositoryRoot = yield* repositoryWith(WORKSPACES);

      expect(runPresetAdoptionChecks({ repositoryRoot, config }).configMissing).toBe(true);
    }),
  );
});
