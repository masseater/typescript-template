import { NodeServices } from "@effect/platform-node";
import { Effect, Path, PlatformError, Schema } from "effect";

const layer = NodeServices.layer;

const path = Effect.runSync(Effect.provide(Path.Path, Path.layer));

function isSystemError(
  error: PlatformError.PlatformError,
  tag: PlatformError.SystemErrorTag,
): boolean {
  return error.reason instanceof PlatformError.SystemError && error.reason._tag === tag;
}

function isNotFound(error: PlatformError.PlatformError): boolean {
  return isSystemError(error, "NotFound");
}

function encodeJson(value: unknown): Effect.Effect<string, Schema.SchemaError> {
  return Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))(value);
}

export { encodeJson, isNotFound, layer, path };
