import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { workerCompatibility } from "@template/config/worker";

export const localDatabase = {
  binding: "DB",
  database_name: "template-shared",
  database_id: "00000000-0000-0000-0000-000000000001",
  migrations_dir: fileURLToPath(new URL("../migrations", import.meta.url)),
};

export const localDatabasePersistence = fileURLToPath(
  new URL("../../../.local/d1", import.meta.url),
);

export async function writeLocalDatabaseConfig() {
  await mkdir(localDatabasePersistence, { recursive: true, mode: 0o700 });
  const file = `${localDatabasePersistence}/wrangler.generated.json`;
  await writeFile(
    file,
    `${JSON.stringify({
      name: "template-local-database",
      compatibility_date: workerCompatibility.date,
      compatibility_flags: workerCompatibility.flags,
      d1_databases: [localDatabase],
    })}\n`,
    { mode: 0o600 },
  );
  return file;
}
