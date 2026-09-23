import { getSchemaShape } from "@repo/db/testing";
import { Effect, Schema } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { SessionView } from "./contracts.ts";

import type { UserRecord } from "@repo/db";

const storedUser: Pick<
  UserRecord,
  "email" | "id" | "name" | "permission" | "role" | "twoFactorEnabled"
> = {
  email: "member@example.test",
  id: "user-1",
  name: "Member",
  permission: null,
  role: "member",
  twoFactorEnabled: false,
};

describe("session user view", () => {
  const it = test
    .extend("decodedSessionUser", (): Promise<
      Pick<UserRecord, "email" | "id" | "name" | "permission" | "role" | "twoFactorEnabled">
    > => Effect.runPromise(Schema.decodeEffect(SessionView.fields.user)(storedUser)))
    .extend("fieldsMissingFromUserRow", () =>
      new Set(Object.keys(SessionView.fields.user.fields)).difference(
        new Set(getSchemaShape()["user"]),
      ),
    );

  it("describes the same field types as the user row", ({ decodedSessionUser }) => {
    expect(decodedSessionUser).toStrictEqual(storedUser);
  });

  it("names no field the user row lacks", ({ fieldsMissingFromUserRow }) => {
    expect(fieldsMissingFromUserRow).toStrictEqual(new Set());
  });
});
