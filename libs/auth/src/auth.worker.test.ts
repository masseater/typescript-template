import { APPLICATION } from "@repo/config";
import { Effect } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { audienceOnEmptyDatabase } from "./testing.ts";

describe("Auth.layer on a database without migrations", () => {
  const it = test
    .extend("wikiBuild", async () => Effect.runPromise(audienceOnEmptyDatabase(APPLICATION.wiki)))
    .extend("userBuild", async () => Effect.runPromise(audienceOnEmptyDatabase(APPLICATION.user)));

  it("fails the wiki while the OAuth provider initializes", ({ wikiBuild }) => {
    expect(wikiBuild).toBe("AuthFailure");
  });

  it("fails the user app while the OAuth resource store initializes", ({ userBuild }) => {
    expect(userBuild).toBe("AuthFailure");
  });
});
