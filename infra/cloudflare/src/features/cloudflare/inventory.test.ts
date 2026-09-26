import { assert, it } from "@effect/vitest";
import { Config, ConfigProvider, Effect } from "effect";

import { compileStack } from "./inventory.ts";
import { verificationEnvironment } from "./verification-settings.ts";

it.effect(
  "compiles a stack without writing the verification values into the process environment",
  () =>
    Effect.gen(function* program() {
      const processSettings = Config.all(
        Object.keys(verificationEnvironment).map((variable) =>
          Config.option(Config.String(variable)),
        ),
      ).pipe(Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromEnv()));
      const before = yield* processSettings;
      yield* compileStack("flagship");
      assert.deepStrictEqual(yield* processSettings, before);
    }),
  { timeout: 60_000 },
);
