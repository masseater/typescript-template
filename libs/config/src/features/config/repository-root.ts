import { Effect, Path } from "effect";

const repositoryRoot = Effect.runSync(
  Effect.gen(function* repositoryRootPath() {
    const path = yield* Path.Path;
    return path.join(import.meta.dirname, "../../../../..");
  }).pipe(Effect.provide(Path.layer)),
);

const repositoryFile = (file: string): string =>
  Effect.runSync(
    Effect.gen(function* resolveRepositoryFile() {
      const path = yield* Path.Path;
      return path.isAbsolute(file) ? file : path.join(repositoryRoot, file);
    }).pipe(Effect.provide(Path.layer)),
  );

export { repositoryFile, repositoryRoot };
