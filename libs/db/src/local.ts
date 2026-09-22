import { NodeServices } from "@effect/platform-node";
import { localDatabase, localDatabaseDirectory } from "@repo/config/local-database-path";
import { workerCompatibility } from "@repo/config/worker";
import { Effect, FileSystem, Path, Schema } from "effect";

const OWNER_ONLY_DIRECTORY_MODE = 0o700;
const OWNER_ONLY_FILE_MODE = 0o600;

function localDatabasePersistence(): string {
  return localDatabaseDirectory();
}

function localDatabaseStore(): string {
  return Effect.runSync(
    Effect.map(Path.Path, (hostPath) => hostPath.join(localDatabasePersistence(), "v3")).pipe(
      Effect.provide(NodeServices.layer),
    ),
  );
}

function writeLocalDatabaseConfig(): Promise<string> {
  return Effect.runPromise(
    Effect.gen(function* writeConfig() {
      const filesystem = yield* FileSystem.FileSystem;
      const hostPath = yield* Path.Path;
      const persistence = localDatabasePersistence();
      yield* filesystem.makeDirectory(persistence, {
        mode: OWNER_ONLY_DIRECTORY_MODE,
        recursive: true,
      });
      const file = hostPath.join(persistence, "wrangler.generated.json");
      const encoded = yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))({
        compatibility_date: workerCompatibility.date,
        compatibility_flags: workerCompatibility.flags,
        d1_databases: [localDatabase],
        name: "template-local-database",
      });
      yield* filesystem.writeFileString(file, `${encoded}\n`, { mode: OWNER_ONLY_FILE_MODE });
      return file;
    }).pipe(Effect.orDie, Effect.provide(NodeServices.layer)),
  );
}

export { localDatabase, localDatabasePersistence, localDatabaseStore, writeLocalDatabaseConfig };
