import { describe, expect, it } from "vite-plus/test";
// oxlint-disable-next-line import/no-nodejs-modules
import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
// oxlint-disable-next-line import/no-nodejs-modules
import path from "node:path";
import { symbolicate } from "./source-maps.ts";
// oxlint-disable-next-line import/no-nodejs-modules
import { tmpdir } from "node:os";

const release = "0123456789abcdef";

function sourceMap(source: string): string {
  return JSON.stringify({
    mappings: "AAAA;AAEEA",
    names: ["check"],
    sources: [source],
    version: 3,
  });
}

async function writeReleaseMaps(root: string): Promise<void> {
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
}

describe("stack location symbolication", () => {
  it("resolves locations to repository sources through the release's private maps", async () => {
    expect.hasAssertions();
    const temporary = await mkdtemp(path.join(tmpdir(), "template-symbolicate-"));
    const root = await realpath(temporary);
    try {
      await writeReleaseMaps(root);
      await expect(
        symbolicate({ app: "user", release, repositoryRoot: root }, [
          "/assets/index-abc.js:2:3",
          "auth-def.js:2:1",
          "/assets/index-abc.js:9:9",
          "missing.js:1:1",
          "private@example.com",
        ]),
      ).resolves.toStrictEqual([
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
      ]);
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });
});
