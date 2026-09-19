import { describe, expect, test } from "vite-plus/test";

import { loginPath, redirectTarget } from "./login-redirect.ts";

const homePath = "/";

describe("post-login redirect target", () => {
  const rejectedLocations = [
    undefined,
    "",
    "https://evil.example/",
    "//evil.example/",
    String.raw`/\evil.example`,
    "/\t/evil.example",
    "/\n/evil.example",
    "/\t\\evil.example",
    "security",
    "/login",
    "/login?redirect=/",
    true,
  ];
  const homeForEveryRejectedLocation = Object.fromEntries(
    rejectedLocations.map((rejected) => [String(rejected), homePath]),
  );
  const it = test
    .extend("theTargetOfAPathCarryingAQuery", () => redirectTarget("/?keyword=alice&page=2"))
    .extend("theTargetOfAPathInsideTheApplication", () => redirectTarget("/security"))
    .extend("theTargetsOfTheRejectedLocations", () =>
      Object.fromEntries(
        rejectedLocations.map((rejected) => [String(rejected), redirectTarget(rejected)]),
      ),
    );

  it("keeps the query of a path inside the app", ({ theTargetOfAPathCarryingAQuery }) => {
    expect(theTargetOfAPathCarryingAQuery).toBe("/?keyword=alice&page=2");
  });

  it("keeps a path inside the app", ({ theTargetOfAPathInsideTheApplication }) => {
    expect(theTargetOfAPathInsideTheApplication).toBe("/security");
  });

  it("falls back to the top page for anything that could leave the app or loop", ({
    theTargetsOfTheRejectedLocations,
  }) => {
    expect(theTargetsOfTheRejectedLocations).toStrictEqual(homeForEveryRejectedLocation);
  });
});

describe("login path", () => {
  const it = test
    .extend("theLoginPathOfALocationCarryingAQuery", () => loginPath("/?keyword=a&page=2"))
    .extend("theLoginPathOfTheTopPage", () => loginPath(homePath))
    .extend("theLoginPathOfALoginLocationCarryingARedirect", () =>
      loginPath("/login?redirect=%2F%3Fkeyword%3Da"),
    )
    .extend("theLoginPathOfTheLoginLocation", () => loginPath("/login"));

  it("carries the current location as the redirect", ({
    theLoginPathOfALocationCarryingAQuery,
  }) => {
    expect(theLoginPathOfALocationCarryingAQuery).toBe(
      "/login?redirect=%2F%3Fkeyword%3Da%26page%3D2",
    );
  });

  it("carries no redirect for the top page", ({ theLoginPathOfTheTopPage }) => {
    expect(theLoginPathOfTheTopPage).toBe("/login");
  });

  it("does not wrap a login location carrying a redirect in another redirect", ({
    theLoginPathOfALoginLocationCarryingARedirect,
  }) => {
    expect(theLoginPathOfALoginLocationCarryingARedirect).toBe("/login?redirect=%2F%3Fkeyword%3Da");
  });

  it("does not wrap the login location in a redirect", ({ theLoginPathOfTheLoginLocation }) => {
    expect(theLoginPathOfTheLoginLocation).toBe("/login");
  });
});
