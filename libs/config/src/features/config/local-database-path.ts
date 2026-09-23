import { Config, ConfigProvider, Effect, Option, Path } from "effect";

const paths = Effect.runSync(Effect.provide(Path.Path, Path.layer));
const localDatabaseVariable = "TEMPLATE_LOCAL_DATABASE";
const repositoryDirectory = paths.join(import.meta.dirname, "../../../../../.local/d1");

const localDatabaseDirectory = (): string => {
  const override = Effect.runSync(
    Config.option(Config.string(localDatabaseVariable)).pipe(
      Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromEnv()),
    ),
  );
  return Option.match(override, {
    onNone: () => repositoryDirectory,
    onSome: (value) => (value === "" ? repositoryDirectory : paths.resolve(value)),
  });
};

const localDatabase = {
  binding: "DB",
  database_id: "00000000-0000-0000-0000-000000000001",
  database_name: "template-shared",
};

const localDatabasePersistence = localDatabaseDirectory();

export { localDatabase, localDatabaseDirectory, localDatabasePersistence, localDatabaseVariable };
