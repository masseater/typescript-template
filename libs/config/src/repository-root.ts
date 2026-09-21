import { Effect, Path } from "effect";

const paths = Effect.runSync(Effect.provide(Path.Path, Path.layer));
const repositoryRoot = paths.join(import.meta.dirname, "../../..");

export { repositoryRoot };
