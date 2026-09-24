import { localDatabase, localDatabaseDirectory } from "@repo/config/local-database-path";
import { workerCompatibility } from "@repo/config/worker";
import { Effect, FileSystem, Path, Schema, type PlatformError } from "effect";

const localDatabasePersistence = (): string => localDatabaseDirectory();

const localDatabaseStore: Effect.Effect<string, never, Path.Path> = Effect.map(Path.Path, (paths) =>
  paths.join(localDatabasePersistence(), "v3"),
);

const writeLocalDatabaseConfig: Effect.Effect<
  string,
  PlatformError.PlatformError | Schema.SchemaError,
  FileSystem.FileSystem | Path.Path
> = Effect.gen(function* writeLocalDatabaseConfig() {
  const filesystem = yield* FileSystem.FileSystem;
  const paths = yield* Path.Path;
  const persistence = localDatabasePersistence();
  yield* filesystem.makeDirectory(persistence, { mode: 0o700, recursive: true });
  const file = paths.join(persistence, "wrangler.generated.json");
  const config = {
    compatibility_date: workerCompatibility.date,
    compatibility_flags: workerCompatibility.flags,
    d1_databases: [localDatabase],
    name: "template-local-database",
  };
  const configText = yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))(config);
  yield* filesystem.writeFileString(file, `${configText}\n`, { mode: 0o600 });
  return file;
});

export { localDatabase, localDatabasePersistence, localDatabaseStore, writeLocalDatabaseConfig };
