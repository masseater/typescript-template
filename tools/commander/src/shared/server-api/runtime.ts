import { Effect, Layer, ManagedRuntime, Schema } from "effect";

import { commanderServices } from "./services.ts";

const Settings = Schema.Struct({
  COMMANDER_ASSETS: Schema.String,
  COMMANDER_DIRECTORY: Schema.String,
  COMMANDER_EXECUTABLE: Schema.String,
  COMMANDER_MODEL: Schema.optionalKey(Schema.String),
  COMMANDER_ORIGIN: Schema.String,
  COMMANDER_STATE: Schema.String,
});

// oxlint-disable-next-line node/no-process-env
const configured = Schema.decodeUnknownEffect(Settings)(process.env).pipe(
  Effect.map((settings) =>
    commanderServices({
      assets: settings.COMMANDER_ASSETS,
      directory: settings.COMMANDER_DIRECTORY,
      executable: settings.COMMANDER_EXECUTABLE,
      model: settings.COMMANDER_MODEL,
      origin: settings.COMMANDER_ORIGIN,
      stateDirectory: settings.COMMANDER_STATE,
    }),
  ),
);
const runtime = ManagedRuntime.make(Layer.unwrap(configured));

export { runtime };
