import { describe, expect, it } from "vite-plus/test";

import { loginPath, redirectTarget } from "./login-redirect";

describe("post-login redirect target", () => {
  it("accepts paths inside the app, keeping their query", () => {
    expect.hasAssertions();
    expect(redirectTarget("/?keyword=alice&page=2")).toBe("/?keyword=alice&page=2");
    expect(redirectTarget("/security")).toBe("/security");
  });

  it("falls back to the top page for anything that could leave the app or loop", () => {
    expect.hasAssertions();
    for (const value of [
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
    ]) {
      expect(redirectTarget(value)).toBe("/");
    }
  });
});

describe("login path", () => {
  it("carries the current location as the redirect", () => {
    expect.hasAssertions();
    expect(loginPath("/?keyword=a&page=2")).toBe("/login?redirect=%2F%3Fkeyword%3Da%26page%3D2");
    expect(loginPath("/")).toBe("/login");
  });

  it("does not wrap a login location in another redirect", () => {
    expect.hasAssertions();
    expect(loginPath("/login?redirect=%2F%3Fkeyword%3Da")).toBe(
      "/login?redirect=%2F%3Fkeyword%3Da",
    );
    expect(loginPath("/login")).toBe("/login");
  });
});
