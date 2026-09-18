import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { assert, it } from "@effect/vitest";
import { Effect } from "effect";

import { symbolicate } from "./source-maps.ts";

const release = "0123456789abcdef";

const sourceMap = (source: string): string => {
  return JSON.stringify({
    mappings: "AAAA;AAEEA",
    names: ["check"],
    sources: [source],
    version: 3,
  });
};

const createTemporaryRoot = async (): Promise<string> => {
  const temporary = await mkdtemp(path.join(tmpdir(), "template-symbolicate-"));
  return realpath(temporary);
};

const writeReleaseMaps = async (root: string): Promise<void> => {
  const directory = path.join(root, ".local/source-maps/user/releases", release);
  await mkdir(path.join(directory, "client/assets"), { recursive: true });
  await mkdir(path.join(directory, "server/assets"), { recursive: true });
  await writeFile(
    path.join(directory, "client/assets/index-abc.js.map"),
    sourceMap("../../../../../libs/ui/src/form.tsx"),
  );
  await writeFile(
    path.join(directory, "server/assets/auth-def.js.map"),
    sourceMap("../../../../../libs/auth/src/index.ts"),
  );
};

const temporaryRoot = Effect.acquireRelease(Effect.promise(createTemporaryRoot), (root) =>
  Effect.promise(async () => rm(root, { force: true, recursive: true })),
);

const expectedFrames: unknown[] = [
  {
    column: 5,
    line: 3,
    location: "/assets/index-abc.js:2:3",
    name: "check",
    resolved: true,
    source: "libs/ui/src/form.tsx",
  },
  {
    column: 3,
    line: 3,
    location: "auth-def.js:2:1",
    name: "check",
    resolved: true,
    source: "libs/auth/src/index.ts",
  },
  { location: "/assets/index-abc.js:9:9", reason: "mapping_missing", resolved: false },
  { location: "missing.js:1:1", reason: "source_map_missing", resolved: false },
  { location: "private@example.com", reason: "location_invalid", resolved: false },
];

it.effect("stack locations resolve to repository sources through the release's private maps", () =>
  Effect.gen(function* program() {
    const root = yield* temporaryRoot;
    yield* Effect.promise(async () => writeReleaseMaps(root));
    const frames = yield* symbolicate({ app: "user", release, repositoryRoot: root }, [
      "/assets/index-abc.js:2:3",
      "auth-def.js:2:1",
      "/assets/index-abc.js:9:9",
      "missing.js:1:1",
      "private@example.com",
    ]);
    assert.deepStrictEqual<unknown>(frames, expectedFrames);
  }).pipe(Effect.scoped),
);
