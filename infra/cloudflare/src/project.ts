import { Effect, Schema } from "effect";
// oxlint-disable-next-line import/no-nodejs-modules
import { fileURLToPath } from "node:url";
// oxlint-disable-next-line import/no-nodejs-modules
import { readFile } from "node:fs/promises";

const Name = Schema.String.check(Schema.isMinLength(1));
const Manifest = Schema.fromJsonString(Schema.Struct({ name: Name }));
const manifestFile = fileURLToPath(new URL("../../../package.json", import.meta.url));

const projectName = Effect.promise(async () => readFile(manifestFile, "utf-8")).pipe(
  Effect.flatMap(Schema.decodeUnknownEffect(Manifest)),
  Effect.orDie,
  Effect.map(({ name }) => name),
);

export { projectName };
