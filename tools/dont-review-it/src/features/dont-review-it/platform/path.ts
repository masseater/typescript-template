import { NodePath } from "@effect/platform-node";
import { Effect, Path } from "effect";

export const path: Path.Path = Effect.runSync(Path.Path.pipe(Effect.provide(NodePath.layer)));
