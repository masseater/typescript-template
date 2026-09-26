import { Effect, Path } from "effect";

import { processSetting, textSetting } from "./process-environment.ts";

const localDatabaseVariable = "TEMPLATE_LOCAL_DATABASE";
const paths = Effect.runSync(Path.Path.pipe(Effect.provide(Path.layer)));
const repositoryDirectory = paths.join(import.meta.dirname, "../../../../../.local/d1");

const localDatabase = {
  binding: "DB",
  database_id: "00000000-0000-0000-0000-000000000001",
  database_name: "template-shared",
};

const localDatabaseOverride = textSetting(localDatabaseVariable);

const localDatabaseDirectory = (): string => {
  const overridePath = processSetting(localDatabaseOverride);
  return overridePath === undefined ? repositoryDirectory : paths.resolve(overridePath);
};

const localDatabasePersistence = localDatabaseDirectory();

export { localDatabase, localDatabaseDirectory, localDatabasePersistence, localDatabaseVariable };
