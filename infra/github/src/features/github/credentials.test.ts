import { ConfigProvider, Effect, Redacted, Result } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { gitHubToken } from "./credentials.ts";

describe("gitHubToken", () => {
  describe.for([
    ["a token", { GITHUB_TOKEN: "operator-token" }, "operator-token"],
    ["no key", {}, 'SchemaError(Expected string\n  at ["GITHUB_TOKEN"])'],
    ["an empty token", { GITHUB_TOKEN: "" }, 'SchemaError(Expected string\n  at ["GITHUB_TOKEN"])'],
  ] as const)("%s", ([, env, promised]) => {
    const it = test.extend("tokenRead", () =>
      Effect.runPromise(
        Effect.result(gitHubToken.parse(ConfigProvider.fromEnv({ env }))).pipe(
          Effect.map((read) =>
            Result.isSuccess(read) ? Redacted.value(read.success) : read.failure.message,
          ),
        ),
      ));

    it("reads the token only from the key it names", ({ tokenRead }) => {
      expect(tokenRead).toBe(promised);
    });
  });
});
