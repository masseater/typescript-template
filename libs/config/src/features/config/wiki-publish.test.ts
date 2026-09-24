import { Effect, Redacted } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { ConfigurationInvalid } from "./configuration-invalid.ts";
import { readWikiPublishConfig, wikiPublishKey } from "./index.ts";

const pemLabel = "PRIVATE KEY";
const privateKey = `-----BEGIN ${pemLabel}-----\nnot-a-real-key\n-----END ${pemLabel}-----\n`;
const complete = {
  [wikiPublishKey.appId]: "123456",
  [wikiPublishKey.privateKey]: privateKey,
  [wikiPublishKey.repository]: "example-owner/example-repo",
};

describe("readWikiPublishConfig", () => {
  describe("bindings without any of the keys", () => {
    const it = test.extend("publishing", () =>
      Effect.runPromise(readWikiPublishConfig({ APP_ORIGIN: "https://app.example.test" })));

    it("leaves publishing off", ({ publishing }) => {
      expect(publishing).toBe(undefined);
    });
  });

  describe("all three keys", () => {
    const it = test
      .extend("publishConfig", () => Effect.runPromise(readWikiPublishConfig(complete)))
      .extend("revealedKey", ({ publishConfig }) =>
        publishConfig === undefined ? undefined : Redacted.value(publishConfig.privateKey),
      );

    it("splits the repository into its owner and name", ({ publishConfig }) => {
      expect(publishConfig).toStrictEqual({
        appId: "123456",
        owner: "example-owner",
        privateKey: Redacted.make(privateKey),
        repository: "example-repo",
      });
    });

    it("keeps the private key behind a redaction", ({ revealedKey }) => {
      expect(revealedKey).toBe(privateKey);
    });
  });

  describe.for([
    ["a partial setting", { [wikiPublishKey.appId]: "123456" }],
    ["a repository without an owner", { ...complete, [wikiPublishKey.repository]: "no-slash" }],
  ] as const)("%s", ([, input]) => {
    const it = test.extend("refusalTag", () =>
      Effect.runPromise(
        readWikiPublishConfig(input).pipe(
          Effect.match({ onFailure: (refusal) => refusal._tag, onSuccess: () => "accepted" }),
        ),
      ));

    it("is refused as invalid configuration", ({ refusalTag }) => {
      expect(refusalTag).toBe(new ConfigurationInvalid({ reason: "" })._tag);
    });
  });
});
