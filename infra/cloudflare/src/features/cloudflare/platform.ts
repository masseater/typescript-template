import { NodeServices } from "@effect/platform-node";
import { isSystemError } from "@repo/cli";
import { Effect, Path, PlatformError, Schema } from "effect";

const layer = NodeServices.layer;

const path = Effect.runSync(Effect.provide(Path.Path, Path.layer));

function isNotFound(error: PlatformError.PlatformError): boolean {
  return isSystemError(error.reason, "NotFound");
}

function encodeJson(value: unknown): Effect.Effect<string, Schema.SchemaError> {
  return Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))(value);
}

export { encodeJson, isNotFound, layer, path };
