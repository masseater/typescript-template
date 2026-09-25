import * as NodePath from "@effect/platform-node/NodePath";
import { Effect, Path } from "effect";

export const path: Path.Path = Effect.runSync(Path.Path.pipe(Effect.provide(NodePath.layer)));

export const posixPath: Path.Path = Effect.runSync(
  Path.Path.pipe(Effect.provide(NodePath.layerPosix)),
);

export const searchPathDelimiter: string = path.sep === "\\" ? ";" : ":";

export const relativePosixPath = (from: string, to: string): string =>
  path.relative(from, to).split(path.sep).join(posixPath.sep);

export const filePathOf = (url: URL): string => Effect.runSync(path.fromFileUrl(url));
