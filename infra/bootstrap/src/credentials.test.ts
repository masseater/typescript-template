import { chmod, mkdtemp, readFile, realpath, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, test } from "vite-plus/test";
import { prepareStateDirectory, readCredentials, writeCredentials } from "./credentials.ts";

const credentials = {
  accountId: "a".repeat(32),
  bucket: "test-state",
  accessKeyId: "b".repeat(32),
  secretAccessKey: "c".repeat(64),
};

test("stores credentials atomically with owner-only permissions", async () => {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), "state-credentials-")));
  try {
    const filename = path.join(root, "state", "r2.json");
    expect(await readCredentials(filename)).toBeUndefined();
    await writeCredentials(filename, credentials);
    expect(await readCredentials(filename)).toEqual(credentials);
    expect((await stat(filename)).mode & 0o777).toBe(0o600);
    expect((await stat(path.dirname(filename))).mode & 0o777).toBe(0o700);
    await chmod(filename, 0o644);
    await expect(readCredentials(filename)).rejects.toThrow("state_credentials_unreadable");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("refuses credential symlink reads and never overwrites their target", async () => {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), "state-credentials-")));
  try {
    const outside = path.join(root, "protected");
    const filename = path.join(root, "r2.json");
    await writeFile(outside, "protected content", { mode: 0o600 });
    await symlink(outside, filename);
    await expect(readCredentials(filename)).rejects.toThrow("state_credentials_unreadable");
    await writeCredentials(filename, credentials);
    expect(await readFile(outside, "utf8")).toBe("protected content");
    expect(await readCredentials(filename)).toEqual(credentials);
    await symlink(root, path.join(root, "alias"));
    await expect(prepareStateDirectory(path.join(root, "alias"))).rejects.toThrow(
      "state_directory_symlink_forbidden",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
