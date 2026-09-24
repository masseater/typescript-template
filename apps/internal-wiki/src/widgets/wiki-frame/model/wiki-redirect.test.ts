import { describe, expect, it } from "vite-plus/test";

import { wikiRedirect } from "./wiki-redirect.ts";

const settled = { error: undefined, loading: false } as const;

describe("wiki session redirect", () => {
  it("stays while the session is loading", () => {
    expect(wikiRedirect({ error: undefined, loading: true, session: undefined }, "/wiki")).toBe(
      undefined,
    );
  });

  it("stays when the session could not be read", () => {
    expect(wikiRedirect({ error: "失敗", loading: false, session: undefined }, "/wiki")).toBe(
      undefined,
    );
  });

  it("stays for a strong session", () => {
    expect(wikiRedirect({ ...settled, session: { strong: true } }, "/wiki")).toBe(undefined);
  });

  it("sends a weak session to the security page", () => {
    expect(wikiRedirect({ ...settled, session: { strong: false } }, "/wiki")).toBe("/security");
  });

  it("sends a signed-out visitor to the login page for the current address", () => {
    expect(wikiRedirect({ ...settled, session: undefined }, "/wiki/a")).toBe(
      "/login?redirect=%2Fwiki%2Fa",
    );
  });
});
