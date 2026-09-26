import { APPLICATION } from "@repo/config";
import { Effect } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { audienceOnEmptyDatabase } from "./index-test-fixture.ts";

describe("Auth.layer on a database without migrations", () => {
  const it = test
    .extend("wikiBuild", () => Effect.runPromise(audienceOnEmptyDatabase(APPLICATION.internalDashboard)))
    .extend("userBuild", () => Effect.runPromise(audienceOnEmptyDatabase(APPLICATION.serviceMember)));

  it("fails the wiki while the OAuth provider initializes", ({ wikiBuild }) => {
    expect(wikiBuild).toBe("AuthFailure");
  });

  it("fails the user app while the OAuth resource store initializes", ({ userBuild }) => {
    expect(userBuild).toBe("AuthFailure");
  });
});
