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
const workspaceSpecifier =
  /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\.meta\.resolve\s*\(\s*|\brequire\s*\(\s*)["'](@repo\/[^"'/]+)/gu;

const { packedPackages, unpackedEntries, unshippedImports } = await Effect.runPromise(
  Effect.scoped(
    Effect.gen(function* packedWorkspaces() {
      const filesystem = yield* FileSystem.FileSystem;
      const paths = yield* Path.Path;
      const shippable = (yield* readShippableWorkspaces(repositoryRoot)).filter(
        (workspace) => !workspace.withheld,
      );
      const shipped = new Set(shippable.map((workspace) => workspace.packageName));
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
            if (result.exitCode !== 0)
              return {
                absent: [`${workspace.packageName}: ${result.stderr}`],
                imported: [],
              };
            const specifiers = publishedEntriesOf({
              manifestValueOf: (key) => propertyValueOf(workspace.manifest.root, key),
              config: defaultShippablePackagesConfig,
            })
              .map((published) => published.specifier)
              .filter((specifier) => specifier.startsWith(packedDirectory));
            const absent = yield* Effect.filter(specifiers, (specifier) =>
              Effect.map(pathExists(paths.join(packed, specifier)), (present) => !present),
            );
            const packedFiles = yield* filesystem.readDirectory(paths.join(packed, packedDirectory), {
              recursive: true,
            });
            const imported = yield* Effect.forEach(
              packedFiles.filter((file) => file.endsWith(".mjs") || file.endsWith(".js")),
              (file) =>
                Effect.map(
                  filesystem.readFileString(paths.join(packed, packedDirectory, file)),
                  (source) =>
                    [...source.matchAll(workspaceSpecifier)]
                      .map(([, packageName]) => packageName)
                      .filter((packageName) => packageName !== undefined && !shipped.has(packageName))
                      .map((packageName) => `${workspace.packageName}: ${file} -> ${packageName}`),
                ),
            );
            return {
              absent: absent.map((specifier) => `${workspace.packageName}: ${specifier}`),
              imported: imported.flat(),
            };
          }),
        { concurrency: "unbounded" },
      );
      return {
        packedPackages: [...shipped].toSorted(),
        unpackedEntries: missing.flatMap((packedWorkspace) => packedWorkspace.absent),
        unshippedImports: missing.flatMap((packedWorkspace) => packedWorkspace.imported),
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

  it("never load a workspace package that npm does not serve", () => {
    expect(unshippedImports).toStrictEqual([]);
  });
});
