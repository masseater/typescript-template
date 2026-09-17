import { Effect } from "effect";
import { loadRemoteMigrations } from "./remote-operations.ts";

async function readMigrations(): Promise<string> {
  const migrations = Effect.orDie(loadRemoteMigrations());
  return JSON.stringify(await Effect.runPromise(migrations));
}

export { readMigrations };
