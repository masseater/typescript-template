import { NodeServices } from "@effect/platform-node";
import { assert, it } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";

import { repositoryRoot } from "./repository-root.ts";

it.effect("points at the directory that holds the workspace manifest", () =>
  Effect.gen(function* program() {
    const filesystem = yield* FileSystem.FileSystem;
    const paths = yield* Path.Path;
    const manifest = yield* filesystem.readFileString(
      paths.join(repositoryRoot, "pnpm-workspace.yaml"),
    );
    assert.include(manifest, "packages:");
  }).pipe(Effect.provide(NodeServices.layer)),
);
