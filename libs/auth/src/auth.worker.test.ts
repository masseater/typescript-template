import { APPLICATION } from "@repo/config";
import { Effect } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { audienceOnEmptyDatabase } from "@repo/auth/testing";

describe("Auth.layer on a database without migrations", () => {
  const it = test
    .extend("wikiBuild", async () => Effect.runPromise(audienceOnEmptyDatabase(APPLICATION.wiki)))
    .extend("userBuild", async () => Effect.runPromise(audienceOnEmptyDatabase(APPLICATION.user)));

  it("fails the wiki while the OAuth provider initializes", ({ wikiBuild }) => {
    expect(wikiBuild).toBe("AuthFailure");
  });

  it("builds the user app, which has no OAuth provider", ({ userBuild }) => {
    expect(userBuild).toBe(APPLICATION.user);
  });
});
