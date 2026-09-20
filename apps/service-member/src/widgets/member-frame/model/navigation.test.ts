import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { memberHasPaidPlan, memberNavItems, titleForPath } from "./navigation.ts";

describe("memberNavItems", () => {
  it("sends free members from 探す to upgrade", () => {
    assert.equal(memberHasPaidPlan, false);
    const search = memberNavItems(false).find((item) => item.id === "search");
    assert.deepEqual(search?.to, "/upgrade");
    assert.equal(search?.paid, true);
  });

  it("keeps paid members on 探す", () => {
    const search = memberNavItems(true).find((item) => item.id === "search");
    assert.deepEqual(search?.to, "/search");
  });

  it("lists the five primary destinations", () => {
    assert.deepEqual(
      memberNavItems(false).map((item) => item.id),
      ["home", "search", "board", "messages", "notifications"],
    );
  });
});

describe("titleForPath", () => {
  it("names known shells and nested pages", () => {
    assert.equal(titleForPath("/home"), "ホーム");
    assert.equal(titleForPath("/users/abc"), "プロフィール");
    assert.equal(titleForPath("/settings/plan"), "設定");
  });
});
