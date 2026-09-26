import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";
import { describe, expect } from "vite-plus/test";

import { defaultTelemetryWiringConfig } from "./config.ts";
import { runTelemetryWiringChecks } from "./run-telemetry-wiring-checks.ts";

const ONE_WORKSPACE = {
  "package.json": `{ "name": "root" }`,
  "packages/measured/package.json": `{ "name": "measured" }`,
};

layer(NodeServices.layer)("runTelemetryWiringChecks", (it) => {
  describe("a test block that declares the telemetry it runs under", () => {
    const reportOverATestBlockDeclaringTelemetryFixture = Effect.gen(
      function* reportOverATestBlockDeclaringTelemetry() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
          prefix: "telemetry-wiring-",
        });
        for (const [relativePath, writtenSource] of Object.entries({
          ...ONE_WORKSPACE,
          "packages/measured/vite.config.ts": `export default defineConfig({
  test: { experimental: { openTelemetry: { enabled: false } } },
});`,
        })) {
          const writtenPath = paths.join(repositoryRoot, relativePath);
          yield* filesystem.makeDirectory(paths.dirname(writtenPath), { recursive: true });
          yield* filesystem.writeFileString(writtenPath, writtenSource);
        }
        return yield* runTelemetryWiringChecks({
          repositoryRoot,
          config: defaultTelemetryWiringConfig,
        });
      },
    );

    it.effect("says nothing about a workspace that declares it", () =>
      Effect.gen(function* program() {
        const reportOverATestBlockDeclaringTelemetry =
          yield* reportOverATestBlockDeclaringTelemetryFixture;
        expect(reportOverATestBlockDeclaringTelemetry).toStrictEqual({ problems: [], scanned: 2 });
      }),
    );
  });

  describe("a test block that spreads a shared test config beside its telemetry", () => {
    const reportOverASpreadTestBlockDeclaringTelemetryFixture = Effect.gen(
      function* reportOverASpreadTestBlockDeclaringTelemetry() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
          prefix: "telemetry-wiring-",
        });
        for (const [relativePath, writtenSource] of Object.entries({
          ...ONE_WORKSPACE,
          "packages/measured/vite.config.ts": `import { toolTest } from "@repo/vite-config";
export default defineConfig({
  test: { ...toolTest, experimental: { openTelemetry: { enabled: false } } },
});`,
        })) {
          const writtenPath = paths.join(repositoryRoot, relativePath);
          yield* filesystem.makeDirectory(paths.dirname(writtenPath), { recursive: true });
          yield* filesystem.writeFileString(writtenPath, writtenSource);
        }
        return yield* runTelemetryWiringChecks({
          repositoryRoot,
          config: defaultTelemetryWiringConfig,
        });
      },
    );

    it.effect("says nothing about a workspace that takes the rest from the shared config", () =>
      Effect.gen(function* program() {
        const reportOverASpreadTestBlockDeclaringTelemetry =
          yield* reportOverASpreadTestBlockDeclaringTelemetryFixture;
        expect(reportOverASpreadTestBlockDeclaringTelemetry).toStrictEqual({
          problems: [],
          scanned: 2,
        });
      }),
    );
  });

  describe("a test block that declares no telemetry", () => {
    const reportOverATestBlockDeclaringNoTelemetryFixture = Effect.gen(
      function* reportOverATestBlockDeclaringNoTelemetry() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
          prefix: "telemetry-wiring-",
        });
        for (const [relativePath, writtenSource] of Object.entries({
          ...ONE_WORKSPACE,
          "packages/measured/vite.config.ts": `export default defineConfig({
  test: { coverage: { thresholds: { 100: true } } },
});`,
        })) {
          const writtenPath = paths.join(repositoryRoot, relativePath);
          yield* filesystem.makeDirectory(paths.dirname(writtenPath), { recursive: true });
          yield* filesystem.writeFileString(writtenPath, writtenSource);
        }
        return yield* runTelemetryWiringChecks({
          repositoryRoot,
          config: defaultTelemetryWiringConfig,
        });
      },
    );

    it.effect("names the configuration that runs the block unmeasured", () =>
      Effect.gen(function* program() {
        const reportOverATestBlockDeclaringNoTelemetry =
          yield* reportOverATestBlockDeclaringNoTelemetryFixture;
        expect(reportOverATestBlockDeclaringNoTelemetry).toStrictEqual({
          problems: [
            {
              file: "packages/measured/vite.config.ts",
              line: 1,
              message:
                "A test block must not run without telemetry, because a workspace nobody measures is indistinguishable from a workspace that is fast. Declare experimental.openTelemetry in this block.",
            },
          ],
          scanned: 2,
        });
      }),
    );
  });

  describe("a configuration without a test block", () => {
    const reportOverAConfigurationWithoutATestBlockFixture = Effect.gen(
      function* reportOverAConfigurationWithoutATestBlock() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        const repositoryRoot = yield* filesystem.makeTempDirectoryScoped({
          prefix: "telemetry-wiring-",
        });
        for (const [relativePath, writtenSource] of Object.entries({
          ...ONE_WORKSPACE,
          "packages/measured/vite.config.ts": `export default defineConfig({
  pack: { entry: ["src/index.ts"] },
});`,
        })) {
          const writtenPath = paths.join(repositoryRoot, relativePath);
          yield* filesystem.makeDirectory(paths.dirname(writtenPath), { recursive: true });
          yield* filesystem.writeFileString(writtenPath, writtenSource);
        }
        return yield* runTelemetryWiringChecks({
          repositoryRoot,
          config: defaultTelemetryWiringConfig,
        });
      },
    );

    it.effect("says nothing about a workspace that spends no time on a test block", () =>
      Effect.gen(function* program() {
        const reportOverAConfigurationWithoutATestBlock =
          yield* reportOverAConfigurationWithoutATestBlockFixture;
        expect(reportOverAConfigurationWithoutATestBlock).toStrictEqual({
          problems: [],
          scanned: 2,
        });
      }),
    );
  });
});
