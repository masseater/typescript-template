import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { assert, it } from "@effect/vitest";
import { Effect } from "effect";
import { symbolicate } from "./source-maps.ts";

const temporaryRoot = Effect.acquireRelease(
  Effect.promise(async () => realpath(await mkdtemp(path.join(tmpdir(), "template-symbolicate-")))),
  (root) => Effect.promise(() => rm(root, { recursive: true, force: true })),
);

it.effect("stack locations resolve to repository sources through the release's private maps", () =>
  Effect.gen(function* () {
    const root = yield* temporaryRoot;
    const release = path.join(root, ".local/source-maps/user/releases/0123456789abcdef");
    const map = (source: string) =>
      JSON.stringify({ version: 3, sources: [source], names: ["check"], mappings: "AAAA;AAEEA" });
    yield* Effect.promise(async () => {
      await mkdir(path.join(release, "client/assets"), { recursive: true });
      await mkdir(path.join(release, "server/assets"), { recursive: true });
      await writeFile(
        path.join(release, "client/assets/index-abc.js.map"),
        map("../../../../../libs/ui/src/form.tsx"),
      );
      await writeFile(
        path.join(release, "server/assets/auth-def.js.map"),
        map("../../../../../libs/auth/src/index.ts"),
      );
    });
    assert.deepStrictEqual(
      yield* symbolicate(root, "user", "0123456789abcdef", [
        "/assets/index-abc.js:2:3",
        "auth-def.js:2:1",
        "/assets/index-abc.js:9:9",
        "missing.js:1:1",
        "private@example.com",
      ]),
      [
        {
          location: "/assets/index-abc.js:2:3",
          resolved: true,
          source: "libs/ui/src/form.tsx",
          line: 3,
          column: 5,
          name: "check",
        },
        {
          location: "auth-def.js:2:1",
          resolved: true,
          source: "libs/auth/src/index.ts",
          line: 3,
          column: 3,
          name: "check",
        },
        { location: "/assets/index-abc.js:9:9", resolved: false, reason: "mapping_missing" },
        { location: "missing.js:1:1", resolved: false, reason: "source_map_missing" },
        { location: "private@example.com", resolved: false, reason: "location_invalid" },
      ],
    );
  }).pipe(Effect.scoped),
);
