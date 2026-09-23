import { ACCOUNT_STATE } from "@repo/config";
import { describe, expect, it } from "vite-plus/test";

import { rowConfirmation } from "./user-labels.ts";

describe("rowConfirmation", () => {
  it("warns that deleting a user cannot be undone", () => {
    expect.hasAssertions();
    expect(
      rowConfirmation(true, { accountState: ACCOUNT_STATE.active, email: "ada@example.com" }),
    ).toStrictEqual({
      confirmLabel: "削除する",
      description: "ada@example.com を削除します。この操作は取り消せません。",
      title: "ユーザーを削除しますか？",
      variant: "danger",
    });
  });

  it("warns that suspending an active user blocks sign-in and hides them", () => {
    expect.hasAssertions();
    expect(
      rowConfirmation(false, { accountState: ACCOUNT_STATE.active, email: "ada@example.com" }),
    ).toStrictEqual({
      confirmLabel: "利用を停止する",
      description:
        "ada@example.com の利用を停止します。停止中はログインできず、他の利用者から見えなくなります。",
      title: "利用を停止するか？",
      variant: "danger",
    });
  });

  it("explains that lifting a suspension restores sign-in and visibility", () => {
    expect.hasAssertions();
    expect(
      rowConfirmation(false, { accountState: ACCOUNT_STATE.suspended, email: "root@example.com" }),
    ).toStrictEqual({
      confirmLabel: "停止を解除する",
      description:
        "root@example.com の停止を解除します。再びログインでき、他の利用者から見えるようになります。",
      title: "停止を解除するか？",
      variant: "primary",
    });
  });
});
