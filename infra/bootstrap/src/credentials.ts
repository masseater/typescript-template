import { constants } from "node:fs";
import { chmod, mkdir, open, realpath, rename, unlink } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { parseCredentials } from "./config.ts";

export async function prepareStateDirectory(directory: string): Promise<void> {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  if ((await realpath(directory)) !== path.resolve(directory))
    throw new Error("state_directory_symlink_forbidden");
  await chmod(directory, 0o700);
}

export async function readCredentials(filename: string) {
  try {
    if ((await realpath(path.dirname(filename))) !== path.resolve(path.dirname(filename)))
      throw new Error("state_directory_symlink_forbidden");
    const handle = await open(filename, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const metadata = await handle.stat();
      if (!metadata.isFile() || metadata.nlink !== 1 || (metadata.mode & 0o077) !== 0)
        throw new Error("state_credentials_permissions_invalid");
      const input: unknown = JSON.parse(await handle.readFile("utf8"));
      return parseCredentials(input);
    } finally {
      await handle.close();
    }
  } catch (error: unknown) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return undefined;
    throw new Error("state_credentials_unreadable", { cause: error });
  }
}

export async function writeCredentials(filename: string, input: unknown): Promise<void> {
  const credentials = parseCredentials(input);
  await prepareStateDirectory(path.dirname(filename));
  const temporary = `${filename}.${randomUUID()}.tmp`;
  const handle = await open(
    temporary,
    constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
    0o600,
  );
  try {
    await handle.writeFile(JSON.stringify(credentials));
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    await rename(temporary, filename);
  } catch {
    await unlink(temporary);
    throw new Error("state_credentials_write_failed");
  }
}
