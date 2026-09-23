import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { localDatabase, localDatabaseDirectory } from "@repo/config/local-database-path";
import { workerCompatibility } from "@repo/config/worker";

const localDatabasePersistence = (): string => localDatabaseDirectory();

const localDatabaseStore = (): string => path.join(localDatabasePersistence(), "v3");

const writeLocalDatabaseConfig = async (): Promise<string> => {
  const persistence = localDatabasePersistence();
  await mkdir(persistence, { mode: 0o700, recursive: true });
  const file = path.join(persistence, "wrangler.generated.json");
  const config = {
    compatibility_date: workerCompatibility.date,
    compatibility_flags: workerCompatibility.flags,
    d1_databases: [localDatabase],
    name: "template-local-database",
  };
  await writeFile(file, `${JSON.stringify(config)}\n`, { mode: 0o600 });
  return file;
};

export { localDatabase, localDatabasePersistence, localDatabaseStore, writeLocalDatabaseConfig };
