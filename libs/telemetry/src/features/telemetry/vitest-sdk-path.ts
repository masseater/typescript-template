import { Effect, Path } from "effect";

import { telemetryAsked } from "./optional-setting.ts";

const sdkFilePath = (resolvedSdk: string): string =>
  Effect.runSync(
    Effect.flatMap(Path.Path, (paths) => paths.fromFileUrl(new URL(resolvedSdk))).pipe(
      Effect.provide(Path.layer),
    ),
  );

const vitestOpenTelemetry = {
  enabled: telemetryAsked,
  sdkPath: sdkFilePath(import.meta.resolve("./vitest-sdk.ts")),
};

export { sdkFilePath, vitestOpenTelemetry };
