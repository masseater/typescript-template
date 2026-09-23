import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem, Path, PlatformError } from "effect";

const nodeServices = NodeServices.layer;
const paths = Effect.runSync(Effect.provide(Path.Path, nodeServices));
const filesystem = Effect.runSync(Effect.provide(FileSystem.FileSystem, nodeServices));

const isNotFound = (platformError: unknown): boolean =>
  platformError instanceof PlatformError.PlatformError &&
  platformError.reason instanceof PlatformError.SystemError &&
  platformError.reason._tag === "NotFound";

export { filesystem, isNotFound, paths };
