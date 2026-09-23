import { describe, expect, test } from "vite-plus/test";

import { grantsAdminLevel, grantsStaffLevel, roles } from "./identity.ts";

describe("roles", () => {
  const it = test.extend("roleNames", () => roles);

  it("uses the member, administrator and staff vocabulary", ({ roleNames }) => {
    expect(roleNames).toStrictEqual(["member", "admin", "staff"]);
  });
});

describe.for([
  ["owner", "operator", true],
  ["operator", "operator", true],
  ["viewer", "operator", false],
  ["editor", "viewer", false],
  [null, "viewer", false],
  [undefined, "viewer", false],
] as const)("an administrator holding %s asked for %s", ([held, required, granted]) => {
  const it = test.extend("adminGranted", () => grantsAdminLevel(held, required));

  it(`is ${granted ? "granted" : "refused"}`, ({ adminGranted }) => {
    expect(adminGranted).toBe(granted);
  });
});

describe.for([
  ["editor", "viewer", true],
  ["viewer", "viewer", true],
  ["viewer", "editor", false],
  ["owner", "viewer", false],
  [null, "viewer", false],
] as const)("a staff member holding %s asked for %s", ([held, required, granted]) => {
  const it = test.extend("staffGranted", () => grantsStaffLevel(held, required));

  it(`is ${granted ? "granted" : "refused"}`, ({ staffGranted }) => {
    expect(staffGranted).toBe(granted);
  });
});
