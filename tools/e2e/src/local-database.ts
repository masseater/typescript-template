import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { localDatabaseVariable } from "@repo/config/local-database-path";

import { repositoryRoot, vitePlus } from "./repository.ts";

const runVitePlus = promisify(execFile);
const databasePackage = "@repo/db-local";
const prefix = "template-e2e-";

type Environment = Readonly<Record<string, string | undefined>>;

type IsolatedDatabase = {
  readonly directory: string;
  readonly environment: Environment;
  readonly promoteToAdministrator: (email: string) => Promise<void>;
  readonly remove: () => Promise<void>;
};

const startIsolatedDatabase = async (): Promise<IsolatedDatabase> => {
  const directory = await mkdtemp(path.join(tmpdir(), prefix));
  const environment = { ...process.env, [localDatabaseVariable]: directory };
  await runVitePlus(vitePlus, ["run", "--filter", databasePackage, "db:migrate:local"], {
    cwd: repositoryRoot,
    env: environment,
  });
  return {
    directory,
    environment,
    promoteToAdministrator: async (email: string) => {
      await runVitePlus(
        vitePlus,
        ["run", "--filter", databasePackage, "db:bootstrap:local", email],
        {
          cwd: repositoryRoot,
          env: environment,
        },
      );
    },
    remove: async () => {
      await rm(directory, { force: true, recursive: true });
    },
  };
};

export { startIsolatedDatabase };
export type { Environment, IsolatedDatabase };
