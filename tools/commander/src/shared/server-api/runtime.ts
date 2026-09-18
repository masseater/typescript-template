import { Config, Effect, Layer, Option } from "effect";

import { workerRuntime } from "@repo/runtime/worker";

import { commanderServices } from "./services.ts";

const settings = Config.all({
  assets: Config.string("COMMANDER_ASSETS"),
  directory: Config.string("COMMANDER_DIRECTORY"),
  executable: Config.string("COMMANDER_EXECUTABLE"),
  model: Config.option(Config.string("COMMANDER_MODEL")).pipe(Config.map(Option.getOrUndefined)),
  origin: Config.string("COMMANDER_ORIGIN"),
  stateDirectory: Config.string("COMMANDER_STATE"),
});

const configured = Effect.gen(function* configured() {
  return commanderServices(yield* settings);
});
const runtime = workerRuntime(() => Layer.unwrap(configured));

export { runtime };
