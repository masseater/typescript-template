import { readFile } from "node:fs/promises";
import path from "node:path";

import { assert, it } from "@effect/vitest";
import { Effect } from "effect";

import { repositoryRoot } from "./repository-root.ts";

it.effect("points at the directory that holds the workspace manifest", () =>
  Effect.gen(function* program() {
    const manifest = yield* Effect.promise(async () =>
      readFile(path.join(repositoryRoot, "pnpm-workspace.yaml"), "utf8"),
    );
    assert.include(manifest, "packages:");
  }),
);
