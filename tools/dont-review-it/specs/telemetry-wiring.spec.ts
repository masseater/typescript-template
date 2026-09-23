import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";
import { expect } from "vite-plus/test";

import { defaultTelemetryWiringConfig } from "../src/features/dont-review-it/telemetry-wiring/config.ts";
import { runTelemetryWiringChecks } from "../src/features/dont-review-it/telemetry-wiring/run-telemetry-wiring-checks.ts";

const config = defaultTelemetryWiringConfig;

const WORKSPACES = {
  "package.json": `{"spelled": "root"}`,
  "packages/measured/package.json": `{"spelled": "measured"}`,
};

const repositoryWith = (files: Readonly<Record<string, string>>) =>
  Effect.gen(function* repositoryWith() {
    const filesystem = yield* FileSystem.FileSystem;
    const paths = yield* Path.Path;
    const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
      prefix: "dont-review-it-telemetry-wiring-",
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

layer(NodeServices.layer)("計測の配線の検査", (it) => {
  it.effect("計測を宣言している test ブロックを黙って通す", () =>
    Effect.gen(function* program() {
      const repositoryRoot = yield* repositoryWith({
        ...WORKSPACES,
        "packages/measured/vite.config.ts": `export default defineConfig({
  test: { experimental: { openTelemetry: { enabled: true, sdkPath: "./sdk.ts" } } },
});`,
      });

      expect((yield* runTelemetryWiringChecks({ repositoryRoot, config })).problems).toStrictEqual(
        [],
      );
    }),
  );

  it.effect("計測を宣言していない test ブロックを、宣言を足す指示とともに報告する", () =>
    Effect.gen(function* program() {
      const repositoryRoot = yield* repositoryWith({
        ...WORKSPACES,
        "packages/measured/vite.config.ts": `export default defineConfig({
  test: { testTimeout: 15000 },
});`,
      });

      expect((yield* runTelemetryWiringChecks({ repositoryRoot, config })).problems).toStrictEqual([
        {
          file: "packages/measured/vite.config.ts",
          line: 1,
          message:
            "A test block must not run without telemetry, because a workspace nobody measures is indistinguishable from a workspace that is fast. Declare experimental.openTelemetry in this block.",
        },
      ]);
    }),
  );

  it.effect("宣言の途中までしか書かれていない test ブロックも報告する", () =>
    Effect.gen(function* program() {
      const repositoryRoot = yield* repositoryWith({
        ...WORKSPACES,
        "packages/measured/vite.config.ts": `export default defineConfig({
  test: { experimental: { defaultBrowserPort: 63315 } },
});`,
      });

      expect((yield* runTelemetryWiringChecks({ repositoryRoot, config })).problems).toHaveLength(
        1,
      );
    }),
  );

  it.effect("宣言された計測が無効にされていても、宣言があるものとして通す", () =>
    Effect.gen(function* program() {
      const repositoryRoot = yield* repositoryWith({
        ...WORKSPACES,
        "packages/measured/vite.config.ts": `export default defineConfig({
  test: { experimental: { openTelemetry: { enabled: false } } },
});`,
      });

      expect((yield* runTelemetryWiringChecks({ repositoryRoot, config })).problems).toStrictEqual(
        [],
      );
    }),
  );

  it.effect("test ブロックを持たない設定を報告しない", () =>
    Effect.gen(function* program() {
      const repositoryRoot = yield* repositoryWith({
        ...WORKSPACES,
        "packages/measured/vite.config.ts": `export default defineConfig({
  pack: { entry: ["src/index.ts"] },
});`,
      });

      expect((yield* runTelemetryWiringChecks({ repositoryRoot, config })).problems).toStrictEqual(
        [],
      );
    }),
  );

  it.effect("ツールチェーンの設定を持たないワークスペースを報告しない", () =>
    Effect.gen(function* program() {
      const repositoryRoot = yield* repositoryWith(WORKSPACES);

      expect((yield* runTelemetryWiringChecks({ repositoryRoot, config })).problems).toStrictEqual(
        [],
      );
    }),
  );

  it.effect("マニフェストを持つディレクトリを、開いた対象として数える", () =>
    Effect.gen(function* program() {
      const repositoryRoot = yield* repositoryWith(WORKSPACES);

      expect((yield* runTelemetryWiringChecks({ repositoryRoot, config })).scanned).toBe(2);
    }),
  );
});
