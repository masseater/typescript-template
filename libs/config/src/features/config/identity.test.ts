import { describe, expect, it } from "vite-plus/test";

import { grantsAdminLevel, grantsStaffLevel } from "./identity.ts";

describe("grantsAdminLevel", () => {
  it.for([
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
  it.for([
    ["editor", "viewer", true],
    ["viewer", "viewer", true],
    ["viewer", "editor", false],
    ["owner", "viewer", false],
    [null, "viewer", false],
  ] as const)("%s against %s grants %s", ([held, required, granted]) => {
    expect(grantsStaffLevel(held, required)).toBe(granted);
  });
});
