import { describe, expect, it } from "vite-plus/test";

import { classifySocialUrl } from "./registry.ts";

describe("classifySocialUrl", () => {
  it.for([
    ["https://x.com/masseater", "x"],
    ["https://twitter.com/masseater", "x"],
    ["https://www.github.com/masseater", "github"],
    ["https://instagram.com/masseater", "instagram"],
    ["https://www.facebook.com/masseater", "facebook"],
    ["https://linkedin.com/in/masseater", "linkedin"],
    ["https://youtu.be/dQw4w9WgXcQ", "youtube"],
  ] as const)("detects %s as %s", ([url, id]) => {
    expect.hasAssertions();
    expect(classifySocialUrl(url)).toMatchObject({
      network: { id },
      ok: true,
      url: new URL(url).href,
    });
  });

  it("accepts an unknown https host without a network", () => {
    expect.hasAssertions();
    expect(classifySocialUrl("https://example.com/me")).toStrictEqual({
      network: null,
      ok: true,
      url: "https://example.com/me",
    });
  });

  it.for(["http://x.com/masseater", "ftp://github.com/masseater", "x.com/masseater"] as const)(
    "rejects non-https %s",
    (url) => {
      expect.hasAssertions();
      expect(classifySocialUrl(url)).toStrictEqual({
        ok: false,
        reason: url.includes("://") ? "not-https" : "invalid",
      });
    },
  );

  it("rejects an unparseable value", () => {
    expect.hasAssertions();
    expect(classifySocialUrl("not a url")).toStrictEqual({ ok: false, reason: "invalid" });
  });
});
