import { Effect, Path } from "effect";

const vitestSdkPath: string = Effect.runSync(
  Effect.flatMap(Path.Path, (paths) =>
    paths.fromFileUrl(new URL(import.meta.resolve("@repo/ai-native-telemetry/vitest-sdk"))),
  ).pipe(Effect.provide(Path.layer)),
);

export { vitestSdkPath };
