import { ROLE } from "@repo/config";
import { describe, expect, it } from "vite-plus/test";

import { rowConfirmation } from "./user-labels.ts";

describe("rowConfirmation", () => {
  it("warns that deleting a user cannot be undone", () => {
    expect.hasAssertions();
    expect(rowConfirmation(true, { email: "ada@example.com", role: ROLE.member })).toStrictEqual({
      confirmLabel: "削除する",
      description: "ada@example.com を削除します。この操作は取り消せません。",
      title: "ユーザーを削除しますか？",
      variant: "danger",
    });
  });

  it("names the role a member is promoted to and the sessions it revokes", () => {
    expect.hasAssertions();
    expect(rowConfirmation(false, { email: "ada@example.com", role: ROLE.member })).toStrictEqual({
      confirmLabel: "変更する",
      description:
        "ada@example.com を管理者に変更します。対象ユーザーの既存セッションは失効します。",
      title: "権限を変更しますか？",
      variant: "primary",
    });
  });

  it("names the member role when an administrator is demoted", () => {
    expect.hasAssertions();
    expect(
      rowConfirmation(false, { email: "root@example.com", role: ROLE.administrator }).description,
    ).toBe(
      "root@example.com を一般ユーザーに変更します。対象ユーザーの既存セッションは失効します。",
    );
  });
});
