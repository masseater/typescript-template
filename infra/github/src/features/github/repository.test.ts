import { ConfigProvider, Effect, Result } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { matchingRepository, targetRepository } from "./repository.ts";

describe("targetRepository", () => {
  describe.for([
    ["a slug", { GITHUB_REPOSITORY: "acme/widgets" }, { owner: "acme", repository: "widgets" }],
    ["no key", {}, 'SchemaError(Expected string\n  at ["GITHUB_REPOSITORY"])'],
    [
      "a URL",
      { GITHUB_REPOSITORY: "https://github.com/acme/widgets" },
      'SchemaError(GITHUB_REPOSITORY must be owner/repository\n  at ["GITHUB_REPOSITORY"])',
    ],
  ] as const)("%s", ([, env, promised]) => {
    const it = test.extend("repositoryRead", () =>
      Effect.runPromise(
        Effect.result(targetRepository.parse(ConfigProvider.fromEnv({ env }))).pipe(
          Effect.map((read) => (Result.isSuccess(read) ? read.success : read.failure.message)),
        ),
      ));

    it("reads the repository or names the key it needs", ({ repositoryRead }) => {
      expect(repositoryRead).toStrictEqual(promised);
    });
  });
});

describe("matchingRepository", () => {
  describe.for([
    ["the same repository in another case", { owner: "Acme", repository: "Widgets" }, undefined],
    [
      "another repository",
      { owner: "acme", repository: "gadgets" },
      ["GITHUB_REPOSITORY", "acme/widgets", "acme/gadgets"],
    ],
  ] as const)("%s", ([, viewed, promisedKeys]) => {
    const it = test.extend("mismatchKeys", () =>
      Effect.runPromise(
        Effect.result(matchingRepository({ owner: "acme", repository: "widgets" }, viewed)).pipe(
          Effect.map((matched) => (Result.isFailure(matched) ? matched.failure.keys : undefined)),
        ),
      ));

    it("refuses a checkout that is not the declared repository", ({ mismatchKeys }) => {
      expect(mismatchKeys).toStrictEqual(promisedKeys);
    });
  });
});
