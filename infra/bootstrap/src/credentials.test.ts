// oxlint-disable-next-line import/no-nodejs-modules
import { chmod, mkdtemp, readFile, realpath, rm, stat, symlink, writeFile } from "node:fs/promises";
import { describe, expect, it } from "vite-plus/test";
import { prepareStateDirectory, readCredentials, writeCredentials } from "./credentials.ts";
// oxlint-disable-next-line import/no-nodejs-modules
import path from "node:path";
// oxlint-disable-next-line import/no-nodejs-modules
import { tmpdir } from "node:os";

const HEX_32_LENGTH = 32;
const HEX_64_LENGTH = 64;
const PERMISSION_BITS = 0o777;
const OWNER_ONLY_FILE_MODE = 0o600;
const OWNER_ONLY_DIRECTORY_MODE = 0o700;
const WORLD_READABLE_FILE_MODE = 0o644;

const credentials = {
  accessKeyId: "b".repeat(HEX_32_LENGTH),
  accountId: "a".repeat(HEX_32_LENGTH),
  bucket: "test-state",
  secretAccessKey: "c".repeat(HEX_64_LENGTH),
};

async function withTemporaryRoot(run: (root: string) => Promise<void>): Promise<void> {
  const temporary = await mkdtemp(path.join(tmpdir(), "state-credentials-"));
  const root = await realpath(temporary);
  try {
    await run(root);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
}

async function permissions(filename: string): Promise<number> {
  const metadata = await stat(filename);
  // oxlint-disable-next-line no-bitwise
  return metadata.mode & PERMISSION_BITS;
}

describe("state credentials storage", () => {
  it("stores credentials atomically with owner-only permissions", async () => {
    expect.hasAssertions();
    await withTemporaryRoot(async (root) => {
      const filename = path.join(root, "state", "r2.json");
      await expect(readCredentials(filename)).resolves.toBeUndefined();
      await writeCredentials(filename, credentials);
      await expect(readCredentials(filename)).resolves.toStrictEqual(credentials);
      await expect(permissions(filename)).resolves.toBe(OWNER_ONLY_FILE_MODE);
      await expect(permissions(path.dirname(filename))).resolves.toBe(OWNER_ONLY_DIRECTORY_MODE);
    });
  });

  it("refuses credentials readable by other users", async () => {
    expect.hasAssertions();
    await withTemporaryRoot(async (root) => {
      const filename = path.join(root, "state", "r2.json");
      await writeCredentials(filename, credentials);
      await chmod(filename, WORLD_READABLE_FILE_MODE);
      await expect(readCredentials(filename)).rejects.toThrow("state_credentials_unreadable");
    });
  });

  it("refuses credential symlink reads and never overwrites their target", async () => {
    expect.hasAssertions();
    await withTemporaryRoot(async (root) => {
      const outside = path.join(root, "protected");
      const filename = path.join(root, "r2.json");
      await writeFile(outside, "protected content", { mode: OWNER_ONLY_FILE_MODE });
      await symlink(outside, filename);
      await expect(readCredentials(filename)).rejects.toThrow("state_credentials_unreadable");
      await writeCredentials(filename, credentials);
      await expect(readFile(outside, "utf-8")).resolves.toBe("protected content");
      await expect(readCredentials(filename)).resolves.toStrictEqual(credentials);
    });
  });

  it("refuses a symlinked state directory", async () => {
    expect.hasAssertions();
    await withTemporaryRoot(async (root) => {
      await symlink(root, path.join(root, "alias"));
      await expect(prepareStateDirectory(path.join(root, "alias"))).rejects.toThrow(
        "state_directory_symlink_forbidden",
      );
    });
  });
});
