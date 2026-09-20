import { getSchemaShape } from "@repo/db/testing";
import { describe, expect, it } from "vite-plus/test";

import { SessionView } from "./contracts.ts";

import type { UserRecord } from "@repo/db";

type Matches<View, Fields extends keyof UserRecord> = [View] extends [Pick<UserRecord, Fields>]
  ? [Pick<UserRecord, Fields>] extends [View]
    ? true
    : false
  : false;

const sessionUserMatchesRecord: Matches<
  (typeof SessionView.Type)["user"],
  "email" | "id" | "name" | "role" | "twoFactorEnabled"
> = true;

describe("session user view", () => {
  it("describes the same field types as the user row", () => {
    expect.hasAssertions();
    expect(sessionUserMatchesRecord).toBe(true);
    const shape = getSchemaShape("user");
    for (const [field, schema] of Object.entries(SessionView.fields.user.fields)) {
      expect(shape[field], `SessionUser.${field}`).toBe(schema.ast._tag);
    }
  });
});
