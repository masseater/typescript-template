import { layer as alchemistRuntime } from "alchemy/Alchemist";
import { AlchemyContext } from "alchemy/AlchemyContext";
import { Effect, FileSystem, Layer, Path } from "effect";

const updatingContext = Layer.effect(
  AlchemyContext,
  Effect.gen(function* alchemyContext() {
    const filesystem = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const directory = path.join(process.cwd(), ".alchemy");
    yield* filesystem.makeDirectory(directory, { recursive: true });
    return {
      adopt: false,
      dev: false,
      dotAlchemy: directory,
      updateStateStore: true,
    };
  }),
);

function layer() {
  return updatingContext.pipe(Layer.provideMerge(alchemistRuntime()));
}

export { layer };
