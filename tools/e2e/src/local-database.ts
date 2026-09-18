// oxlint-disable-next-line import/no-nodejs-modules
import { execFile } from "node:child_process";
// oxlint-disable-next-line import/no-nodejs-modules
import { mkdtemp, rm } from "node:fs/promises";
// oxlint-disable-next-line import/no-nodejs-modules
import { tmpdir } from "node:os";
// oxlint-disable-next-line import/no-nodejs-modules
import path from "node:path";
// oxlint-disable-next-line import/no-nodejs-modules
import { promisify } from "node:util";

import { localDatabaseVariable } from "@repo/config/local-database-path";

import { packageRoot, repositoryRoot } from "./repository.ts";

// oxlint-disable-next-line typescript/strict-void-return
const run = promisify(execFile);
const vitePlus = packageRoot("node_modules/.bin/vp");
const databasePackage = "@repo/db";
const prefix = "template-e2e-";

type Environment = Readonly<Record<string, string | undefined>>;

interface IsolatedDatabase {
  readonly directory: string;
  readonly environment: Environment;
  readonly promoteToAdministrator: (email: string) => Promise<void>;
  readonly remove: () => Promise<void>;
}

async function startIsolatedDatabase(): Promise<IsolatedDatabase> {
  const directory = await mkdtemp(path.join(tmpdir(), prefix));
  // oxlint-disable-next-line node/no-process-env
  const environment = { ...process.env, [localDatabaseVariable]: directory };
  await run(vitePlus, ["run", "--filter", databasePackage, "db:migrate:local"], {
    cwd: repositoryRoot,
    env: environment,
  });
  return {
    directory,
    environment,
    promoteToAdministrator: async (email: string) => {
      await run(vitePlus, ["run", "--filter", databasePackage, "db:bootstrap:local", email], {
        cwd: repositoryRoot,
        env: environment,
      });
    },
    remove: async () => {
      await rm(directory, { force: true, recursive: true });
    },
  };
}

export { startIsolatedDatabase };
export type { Environment, IsolatedDatabase };
