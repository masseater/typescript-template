// oxlint-disable-next-line import/no-nodejs-modules
import { mkdir, writeFile } from "node:fs/promises";
// oxlint-disable-next-line import/no-nodejs-modules
import path from "node:path";
import { workerCompatibility } from "@repo/config/worker";

const OWNER_ONLY_DIRECTORY_MODE = 0o700;
const OWNER_ONLY_FILE_MODE = 0o600;

const localDatabase = {
  binding: "DB",
  database_id: "00000000-0000-0000-0000-000000000001",
  database_name: "template-shared",
};

const localDatabasePersistence = path.join(import.meta.dirname, "../../../.local/d1");
const localDatabaseStore = path.join(localDatabasePersistence, "v3");

async function writeLocalDatabaseConfig(): Promise<string> {
  await mkdir(localDatabasePersistence, { mode: OWNER_ONLY_DIRECTORY_MODE, recursive: true });
  const file = path.join(localDatabasePersistence, "wrangler.generated.json");
  const config = {
    compatibility_date: workerCompatibility.date,
    compatibility_flags: workerCompatibility.flags,
    d1_databases: [localDatabase],
    name: "template-local-database",
  };
  await writeFile(file, `${JSON.stringify(config)}\n`, { mode: OWNER_ONLY_FILE_MODE });
  return file;
}

export { localDatabase, localDatabasePersistence, localDatabaseStore, writeLocalDatabaseConfig };
