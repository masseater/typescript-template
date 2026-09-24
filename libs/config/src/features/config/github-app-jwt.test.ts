import { Effect, Redacted } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { signGitHubAppJwt } from "./index.ts";
import { gitHubAppKeyFixture } from "./testing.ts";

const pemLabel = "PRIVATE KEY";

describe("signGitHubAppJwt", () => {
  describe.for(["pkcs8", "pkcs1"] as const)("a %s key from GitHub", (format) => {
    const it = test.extend("verdicts", () =>
      Effect.runPromise(
        Effect.gen(function* signAndVerify() {
          const appKey = yield* gitHubAppKeyFixture(format);
          const jwt = yield* signGitHubAppJwt({
            appId: "4242",
            privateKey: Redacted.make(appKey.privateKey),
          });
          return yield* Effect.promise(() =>
            Promise.all([
              appKey.signedBy(`Bearer ${Redacted.value(jwt)}`, "4242"),
              appKey.signedBy(`Bearer ${Redacted.value(jwt)}`, "1"),
            ]),
          );
        }),
      ));

    it("signs a token that names the App and no other", ({ verdicts }) => {
      expect(verdicts).toStrictEqual([true, false]);
    });
  });

  describe.for([
    ["a body that is not base64", "%%%"],
    ["base64 that is not a key", "AAAA"],
  ] as const)("a key with %s", ([, pemBody]) => {
    const it = test.extend("refusalTag", () =>
      Effect.runPromise(
        Effect.flip(
          signGitHubAppJwt({
            appId: "4242",
            privateKey: Redacted.make(
              `-----BEGIN ${pemLabel}-----\n${pemBody}\n-----END ${pemLabel}-----\n`,
            ),
          }),
        ).pipe(Effect.map((refusal) => refusal._tag)),
      ));

    it("is refused as an invalid key", ({ refusalTag }) => {
      expect(refusalTag).toBe("GitHubAppKeyInvalid");
    });
  });
});
