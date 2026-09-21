import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem, Path, PlatformError } from "effect";

const layer = NodeServices.layer;
const paths = Effect.runSync(Effect.provide(Path.Path, layer));
const filesystem = Effect.runSync(Effect.provide(FileSystem.FileSystem, layer));

const isNotFound = (error: unknown): boolean =>
  error instanceof PlatformError.PlatformError &&
  error.reason instanceof PlatformError.SystemError &&
  error.reason._tag === "NotFound";

export { filesystem, isNotFound, paths };
