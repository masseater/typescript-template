import { Effect } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { filesystem, paths } from "./host.ts";
import { UnlistableWorkspace, workspaceDependencyRanges } from "./workspace-packages.ts";

const workspaceAt = Effect.fn("workspaceAt")(function* workspaceAt(
  files: Readonly<Record<string, string>>,
) {
  const root = yield* filesystem.makeTempDirectoryScoped({ prefix: "workspace-packages-" });
  yield* Effect.forEach(Object.entries(files), ([file, fileSource]) =>
    Effect.gen(function* writeWorkspaceFile() {
      yield* filesystem.makeDirectory(paths.dirname(paths.join(root, file)), { recursive: true });
      yield* filesystem.writeFileString(paths.join(root, file), fileSource);
    }),
  );
  return root;
});

describe("workspaceDependencyRanges", () => {
  const it = test
    .extend("ranges", () =>
      Effect.runPromise(
        Effect.scoped(
          Effect.flatMap(
            workspaceAt({
              "pnpm-workspace.yaml": "packages:\n  - apps/*\n  - libs/*\n",
              "package.json": `{"name":"root","devDependencies":{"@x/web":"workspace:*"}}`,
              "apps/web/package.json": `{"name":"@x/web","dependencies":{"@x/core":"workspace:*","effect":"4.0.0"},"devDependencies":{"@x/build":"workspace:^"}}`,
              "apps/README.md": "not a package\n",
              "apps/drafts/notes.md": "not a package\n",
              "libs/core/package.json": `{"name":"@x/core","optionalDependencies":{"@x/log":"workspace:*"},"peerDependencies":{"@x/types":"workspace:*"}}`,
              "libs/log/package.json": `{"name":"@x/log","dependencies":{"@x/core":"workspace:*"}}`,
              "libs/build/package.json": `{"name":"@x/build"}`,
              "libs/types/package.json": `{"name":"@x/types"}`,
              "libs/other/package.json": `{"name":"@x/other"}`,
            }),
            workspaceDependencyRanges,
          ),
        ),
      ))
    .extend("unsupportedPattern", () =>
      Effect.runPromise(
        Effect.scoped(
          Effect.flatMap(
            workspaceAt({
              "pnpm-workspace.yaml": "packages:\n  - packages/**\n",
              "package.json": `{"name":"root"}`,
            }),
            (root) =>
              Effect.map(Effect.flip(workspaceDependencyRanges(root)), (failure) => ({
                failure,
                root,
              })),
          ),
        ),
      ),
    )
    .extend("unreadableDefinition", () =>
      Effect.runPromise(
        Effect.scoped(
          Effect.flatMap(
            workspaceAt({
              "pnpm-workspace.yaml": "packages: [apps/*\n",
              "package.json": `{"name":"root"}`,
            }),
            (root) =>
              Effect.map(Effect.flip(workspaceDependencyRanges(root)), (failure) => ({
                failure,
                root,
              })),
          ),
        ),
      ),
    )
    .extend("unprovidedDependency", () =>
      Effect.runPromise(
        Effect.scoped(
          Effect.flatMap(
            workspaceAt({
              "pnpm-workspace.yaml": "packages:\n  - libs/*\n",
              "package.json": `{"name":"root"}`,
              "libs/broken/package.json": `{"name":"@x/broken","dependencies":{"@x/gone":"workspace:*"}}`,
            }),
            (root) =>
              Effect.map(Effect.flip(workspaceDependencyRanges(root)), (failure) => ({
                failure,
                root,
              })),
          ),
        ),
      ),
    );

  it("maps every package a <directory>/* pattern holds to the packages it reaches through workspace dependencies of any kind", ({
    ranges,
  }) => {
    expect(ranges).toStrictEqual(
      new Map([
        [".", [".", "apps/web", "libs/build", "libs/core", "libs/log", "libs/types"]],
        ["apps/web", ["apps/web", "libs/build", "libs/core", "libs/log", "libs/types"]],
        ["libs/build", ["libs/build"]],
        ["libs/core", ["libs/core", "libs/log", "libs/types"]],
        ["libs/log", ["libs/core", "libs/log", "libs/types"]],
        ["libs/other", ["libs/other"]],
        ["libs/types", ["libs/types"]],
      ]),
    );
  });

  it("refuses package patterns other than <directory>/*", ({ unsupportedPattern }) => {
    expect(unsupportedPattern).toStrictEqual({
      failure: new UnlistableWorkspace({
        definition: paths.join(unsupportedPattern.root, "pnpm-workspace.yaml"),
        reason: "packages/** is not a <directory>/* package pattern",
      }),
      root: unsupportedPattern.root,
    });
  });

  it("refuses a workspace definition that is not YAML", ({ unreadableDefinition }) => {
    expect(unreadableDefinition).toStrictEqual({
      failure: new UnlistableWorkspace({
        definition: paths.join(unreadableDefinition.root, "pnpm-workspace.yaml"),
        reason: "it is not YAML",
      }),
      root: unreadableDefinition.root,
    });
  });

  it("refuses a workspace dependency that no package provides", ({ unprovidedDependency }) => {
    expect(unprovidedDependency).toStrictEqual({
      failure: new UnlistableWorkspace({
        definition: paths.join(unprovidedDependency.root, "pnpm-workspace.yaml"),
        reason: "@x/broken depends on @x/gone, which no workspace package provides",
      }),
      root: unprovidedDependency.root,
    });
  });
});
