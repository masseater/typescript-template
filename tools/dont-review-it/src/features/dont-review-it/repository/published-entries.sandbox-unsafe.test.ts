import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem, Path } from "effect";
import { ChildProcess } from "effect/unstable/process";
import { describe, expect, it } from "vite-plus/test";

import { propertyValueOf } from "../intent-skills/manifest.ts";
import { pathExists } from "../platform/file-system.ts";
import { defaultShippablePackagesConfig } from "../shippable-packages/config.ts";
import { publishedEntriesOf } from "../shippable-packages/published-entries.ts";
import { readShippableWorkspaces } from "../shippable-packages/workspace-manifests.ts";
import { capturedProcess } from "./captured-process.ts";
import { repositoryRoot } from "./repository-root.ts";

const packedDirectory = "./dist/";

const { packedPackages, unpackedEntries } = await Effect.runPromise(
  Effect.scoped(
    Effect.gen(function* packedWorkspaces() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const shippable = (yield* readShippableWorkspaces(repositoryRoot)).filter(
        (workspace) => !workspace.withheld,
      );
      const missing = yield* Effect.forEach(
        shippable,
        (workspace) =>
          Effect.gen(function* packedWorkspace() {
            const packed = yield* filesystem.makeTempDirectoryScoped({
              prefix: "published-entries-",
            });
            const result = yield* capturedProcess(
              ChildProcess.make(
                paths.join(repositoryRoot, "node_modules/.bin/vp"),
                ["pack", "--out-dir", paths.join(packed, packedDirectory)],
                { cwd: paths.dirname(workspace.manifest.file.absolutePath) },
              ),
            );
            if (result.exitCode !== 0) return [`${workspace.packageName}: ${result.stderr}`];
            const specifiers = publishedEntriesOf({
              manifestValueOf: (key) => propertyValueOf(workspace.manifest.root, key),
              config: defaultShippablePackagesConfig,
            })
              .map((published) => published.specifier)
              .filter((specifier) => specifier.startsWith(packedDirectory));
            const absent = yield* Effect.filter(specifiers, (specifier) =>
              Effect.map(pathExists(paths.join(packed, specifier)), (present) => !present),
            );
            return absent.map((specifier) => `${workspace.packageName}: ${specifier}`);
          }),
        { concurrency: "unbounded" },
      );
      return {
        packedPackages: shippable.map((workspace) => workspace.packageName).toSorted(),
        unpackedEntries: missing.flat(),
      };
    }),
  ).pipe(Effect.provide(NodeServices.layer)),
);

describe("published entries", () => {
  it("are checked for every package the repository ships", () => {
    expect(packedPackages).toStrictEqual([
      "@repo/ai-native",
      "@repo/ai-native-telemetry",
      "@repo/dont-review-it",
    ]);
  });

  it("resolve to files the pack writes", () => {
    expect(unpackedEntries).toStrictEqual([]);
  });
});
