import { Effect, Path } from "effect";

const sdkFilePath = (resolvedSdk: string): string =>
  Effect.runSync(
    Effect.flatMap(Path.Path, (paths) => paths.fromFileUrl(new URL(resolvedSdk))).pipe(
      Effect.provide(Path.layer),
    ),
  );

export { sdkFilePath };
