import { NodeServices } from "@effect/platform-node";
import { isNotFound } from "@repo/cli";
import { Effect, Path, Schema } from "effect";

const layer = NodeServices.layer;

const path = Effect.runSync(Effect.provide(Path.Path, Path.layer));

function encodeJson(value: unknown): Effect.Effect<string, Schema.SchemaError> {
  return Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))(value);
}

export { encodeJson, isNotFound, layer, path };
