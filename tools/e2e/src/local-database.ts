// oxlint-disable-next-line import/no-nodejs-modules
import { execFile } from "node:child_process";
// oxlint-disable-next-line import/no-nodejs-modules
import { mkdir, rename, rm } from "node:fs/promises";
// oxlint-disable-next-line import/no-nodejs-modules
import { promisify } from "node:util";

import { localDatabasePersistence } from "@repo/db/local";

import { packageRoot } from "./repository.ts";

// oxlint-disable-next-line typescript/strict-void-return
const run = promisify(execFile);
const directoryMode = 0o700;
const database = packageRoot("libs/db");

async function moveAside(from: string, to: string): Promise<boolean> {
  try {
    await rename(from, to);
    return true;
  } catch {
    return false;
  }
}

async function promoteToAdministrator(email: string): Promise<void> {
  await run(process.execPath, ["src/bootstrap-local.ts", email], { cwd: database });
}

async function resetLocalDatabase(): Promise<() => Promise<void>> {
  const stashed = `${localDatabasePersistence}.${crypto.randomUUID()}`;
  const stashedExisting = await moveAside(localDatabasePersistence, stashed);
  await mkdir(localDatabasePersistence, { mode: directoryMode, recursive: true });
  await run(process.execPath, ["src/migrate-local.ts"], { cwd: database });
  return async () => {
    await rm(localDatabasePersistence, { force: true, recursive: true });
    if (stashedExisting) {
      await rename(stashed, localDatabasePersistence);
    }
  };
}

export { promoteToAdministrator, resetLocalDatabase };
