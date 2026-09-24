import { Effect, FileSystem, Schema } from "effect";

import { fileUrlPath, layer } from "./platform.ts";

const Name = Schema.String.check(Schema.isMinLength(1));
const Manifest = Schema.fromJsonString(Schema.Struct({ name: Name }));
const manifestFile = fileUrlPath(new URL("../../../../../package.json", import.meta.url));

const projectName = Effect.gen(function* readProjectName() {
  const filesystem = yield* FileSystem.FileSystem;
  const text = yield* filesystem.readFileString(manifestFile);
  const manifest = yield* Schema.decodeEffect(Manifest)(text);
  return manifest.name;
}).pipe(Effect.orDie, Effect.provide(layer));

export { projectName };
