import { describe, expect, it } from "vite-plus/test";

import { publicContentTrack } from "./public-content-track.ts";

describe("public content track", () => {
  it.for(["/login", "/signup", "/contact", "/verify-email", "/verify-email-change"] as const)(
    "keeps auth and single-task paths on the column track (%s)",
    (pathname) => {
      expect.hasAssertions();
      expect(publicContentTrack(pathname)).toBe("max-w-column");
    },
  );

  it("keeps marketing paths on the page track", () => {
    expect.hasAssertions();
    expect(publicContentTrack("/")).toBe("max-w-page");
  });
});
