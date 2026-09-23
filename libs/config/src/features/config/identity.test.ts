import { describe, expect, test } from "vite-plus/test";

import { grantsAdminLevel, grantsStaffLevel, roles } from "./identity.ts";

describe("roles", () => {
  const it = test.extend("roleNames", () => roles);

  it("uses the member, administrator and staff vocabulary", ({ roleNames }) => {
    expect(roleNames).toStrictEqual(["member", "admin", "staff"]);
  });
});

describe("grantsAdminLevel", () => {
  test.for([
    ["owner", "operator", true],
    ["operator", "operator", true],
    ["viewer", "operator", false],
    ["editor", "viewer", false],
    [null, "viewer", false],
    [undefined, "viewer", false],
  ] as const)("%s against %s grants %s", ([held, required, granted]) => {
    expect(grantsAdminLevel(held, required)).toBe(granted);
  });
});

describe("grantsStaffLevel", () => {
  test.for([
    ["editor", "viewer", true],
    ["viewer", "viewer", true],
    ["viewer", "editor", false],
    ["owner", "viewer", false],
    [null, "viewer", false],
  ] as const)("%s against %s grants %s", ([held, required, granted]) => {
    expect(grantsStaffLevel(held, required)).toBe(granted);
  });
});
