import { describe, expect, test } from "vite-plus/test";

import { roles } from "./identity.ts";

describe("roles", () => {
  const it = test.extend("roleNames", () => roles);

  it("uses the member and administrator vocabulary", ({ roleNames }) => {
    expect(roleNames).toStrictEqual(["member", "admin"]);
  });
});
