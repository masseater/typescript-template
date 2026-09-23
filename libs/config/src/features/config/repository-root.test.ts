import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem, Path } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { repositoryFile, repositoryRoot } from "./repository-root.ts";

describe("the repository root", () => {
  const it = test.extend("theWorkspaceManifestPresence", () =>
    Effect.runPromise(
      Effect.gen(function* findWorkspaceManifest() {
        const filesystem = yield* FileSystem.FileSystem;
        const paths = yield* Path.Path;
        return yield* filesystem.exists(paths.join(repositoryRoot, "pnpm-workspace.yaml"));
      }).pipe(Effect.provide(NodeServices.layer)),
    ));

  it("holds the workspace manifest", ({ theWorkspaceManifestPresence }) => {
    expect(theWorkspaceManifestPresence).toStrictEqual(true);
  });
});

describe("a file named from the repository root", () => {
  const it = test
    .extend("theRelativeFile", () => repositoryFile("pnpm-workspace.yaml"))
    .extend("theAbsoluteFile", () => repositoryFile(repositoryRoot));

  it("resolves a relative name against the root", ({ theRelativeFile }) => {
    expect(theRelativeFile).toStrictEqual(`${repositoryRoot}/pnpm-workspace.yaml`);
  });

  it("keeps an absolute name as it is", ({ theAbsoluteFile }) => {
    expect(theAbsoluteFile).toStrictEqual(repositoryRoot);
  });
});
