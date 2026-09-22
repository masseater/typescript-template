import { Effect, Path } from "effect";

const repositoryRoot = Effect.runSync(
  Effect.gen(function* repositoryRootPath() {
    const path = yield* Path.Path;
    return path.join(import.meta.dirname, "../../..");
  }).pipe(Effect.provide(Path.layer)),
);

export { repositoryRoot };
