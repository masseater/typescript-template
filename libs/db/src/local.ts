import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { localDatabaseDirectory } from "@repo/config/local-database-path";
import { privateDirectoryMode, privateFileMode } from "@repo/config/private-files";
import { workerCompatibility } from "@repo/config/worker";

const localDatabase = {
  binding: "DB",
  database_id: "00000000-0000-0000-0000-000000000001",
  database_name: "template-shared",
};

const localDatabasePersistence = localDatabaseDirectory();
const localDatabaseStore = path.join(localDatabasePersistence, "v3");

const writeLocalDatabaseConfig = async (): Promise<string> => {
  await mkdir(localDatabasePersistence, { mode: privateDirectoryMode, recursive: true });
  const file = path.join(localDatabasePersistence, "wrangler.generated.json");
  const config = {
    compatibility_date: workerCompatibility.date,
    compatibility_flags: workerCompatibility.flags,
    d1_databases: [localDatabase],
    name: "template-local-database",
  };
  await writeFile(file, `${JSON.stringify(config)}\n`, { mode: privateFileMode });
  return file;
};

export { localDatabase, localDatabasePersistence, localDatabaseStore, writeLocalDatabaseConfig };
