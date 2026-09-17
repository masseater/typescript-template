import { chmod, mkdir, open, realpath, rename, unlink } from "node:fs/promises";
import type { StateCredentials } from "./config.ts";
import { constants } from "node:fs";
import { parseCredentials } from "./config.ts";
import path from "node:path";
import { randomUUID } from "node:crypto";

const OWNER_ONLY_DIRECTORY_MODE = 0o700;
const OWNER_ONLY_FILE_MODE = 0o600;
const GROUP_AND_OTHER_PERMISSIONS = 0o077;

async function assertRealDirectory(directory: string): Promise<void> {
  if ((await realpath(directory)) !== path.resolve(directory)) {
    throw new Error("state_directory_symlink_forbidden");
  }
}

async function prepareStateDirectory(directory: string): Promise<void> {
  await mkdir(directory, { mode: OWNER_ONLY_DIRECTORY_MODE, recursive: true });
  await assertRealDirectory(directory);
  await chmod(directory, OWNER_ONLY_DIRECTORY_MODE);
}

async function readOwnerOnlyFile(filename: string): Promise<string> {
  const handle = await open(filename, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const metadata = await handle.stat();
    if (
      !metadata.isFile() ||
      metadata.nlink !== 1 ||
      (metadata.mode & GROUP_AND_OTHER_PERMISSIONS) !== 0
    ) {
      throw new Error("state_credentials_permissions_invalid");
    }
    return await handle.readFile("utf-8");
  } finally {
    await handle.close();
  }
}

async function readCredentials(filename: string): Promise<StateCredentials | undefined> {
  try {
    await assertRealDirectory(path.dirname(filename));
    const input: unknown = JSON.parse(await readOwnerOnlyFile(filename));
    return parseCredentials(input);
  } catch (error: unknown) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return undefined;
    }
    throw new Error("state_credentials_unreadable", { cause: error });
  }
}

async function writeExclusiveFile(filename: string, content: string): Promise<void> {
  const handle = await open(
    filename,
    constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
    OWNER_ONLY_FILE_MODE,
  );
  try {
    await handle.writeFile(content);
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function writeCredentials(filename: string, input: unknown): Promise<void> {
  const credentials = parseCredentials(input);
  await prepareStateDirectory(path.dirname(filename));
  const temporary = `${filename}.${randomUUID()}.tmp`;
  await writeExclusiveFile(temporary, JSON.stringify(credentials));
  try {
    await rename(temporary, filename);
  } catch {
    await unlink(temporary);
    throw new Error("state_credentials_write_failed");
  }
}

export { prepareStateDirectory, readCredentials, writeCredentials };
