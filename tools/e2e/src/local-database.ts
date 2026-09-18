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

import { packageRoot } from "./repository.ts";

// oxlint-disable-next-line typescript/strict-void-return
const run = promisify(execFile);
const database = packageRoot("libs/db");
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
  await run(process.execPath, ["src/migrate-local.ts"], { cwd: database, env: environment });
  return {
    directory,
    environment,
    promoteToAdministrator: async (email: string) => {
      await run(process.execPath, ["src/bootstrap-local.ts", email], {
        cwd: database,
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
