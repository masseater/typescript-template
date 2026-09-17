import { ProfileView, RoleChanged, SessionView, UserDeleted, UserList } from "./contracts.ts";
import { describe, expect, it } from "vite-plus/test";
import type { UserRecord } from "@template/db";
import { getSchemaShape } from "@template/db/testing";

type Matches<View, Fields extends keyof UserRecord> = [View] extends [Pick<UserRecord, Fields>]
  ? [Pick<UserRecord, Fields>] extends [View]
    ? true
    : false
  : false;

const sessionUserMatchesRecord: Matches<
  (typeof SessionView.Type)["user"],
  "email" | "id" | "name" | "role" | "twoFactorEnabled"
> = true;
const profileViewMatchesRecord: Matches<
  typeof ProfileView.Type,
  "email" | "id" | "name" | "profile"
> = true;
const userSummaryMatchesRecord: Matches<
  (typeof UserList.Type)["users"][number],
  "createdAt" | "email" | "emailVerified" | "id" | "name" | "role" | "twoFactorEnabled"
> = true;
const roleChangedMatchesRecord: Matches<typeof RoleChanged.Type, "id" | "role"> = true;
const userDeletedMatchesRecord: Matches<typeof UserDeleted.Type, "id"> = true;

const views = {
  ProfileView: ProfileView.fields,
  RoleChanged: RoleChanged.fields,
  SessionUser: SessionView.fields.user.fields,
  UserDeleted: UserDeleted.fields,
  UserSummary: UserList.fields.users.value.fields,
};

describe("user views", () => {
  it("describe the same field types as the user row", () => {
    expect.hasAssertions();
    expect([
      sessionUserMatchesRecord,
      profileViewMatchesRecord,
      userSummaryMatchesRecord,
      roleChangedMatchesRecord,
      userDeletedMatchesRecord,
    ]).toStrictEqual([true, true, true, true, true]);
  });

  it("name only columns that the user table has", () => {
    expect.hasAssertions();
    const columns = new Set(getSchemaShape()["user"]);
    const unknown = Object.entries(views).flatMap(([view, fields]: readonly [string, object]) =>
      Object.keys(fields)
        .filter((field) => !columns.has(field))
        .map((field) => `${view}.${field}`),
    );
    expect(unknown).toStrictEqual([]);
  });
});
