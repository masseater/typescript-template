import { Config, ConfigProvider, Effect, Option, Path } from "effect";

import { repositoryFile } from "./repository-root.ts";

const localDatabaseVariable = "TEMPLATE_LOCAL_DATABASE";
const paths = Effect.runSync(Path.Path.pipe(Effect.provide(Path.layer)));
const repositoryDirectory = repositoryFile(".local/d1");

const localDatabase = {
  binding: "DB",
  database_id: "00000000-0000-0000-0000-000000000001",
  database_name: "template-shared",
};

const localDatabaseDirectory = (): string => {
  const override = Effect.runSync(
    Config.option(Config.String(localDatabaseVariable)).pipe(
      Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromEnv()),
    ),
  );
  return Option.match(override, {
    onNone: () => repositoryDirectory,
    onSome: (overridePath) =>
      overridePath === "" ? repositoryDirectory : paths.resolve(overridePath),
  });
};

const localDatabasePersistence = localDatabaseDirectory();

export { localDatabase, localDatabaseDirectory, localDatabasePersistence, localDatabaseVariable };
