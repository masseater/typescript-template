import { STAFF_PERMISSION } from "@repo/config";
import { apiData } from "@repo/runtime/client";
import {
  ActionStatus,
  Button,
  Field,
  SelectField,
  formatWarekiDate,
  useAction,
  useTextInput,
} from "@repo/ui";
import { useState } from "react";

import { isStaffPermission, staffPermissionOptions } from "#pages/staff/model/staff-labels.ts";
import { wikiClient } from "#shared/api/index.ts";
import { StaffInvited } from "#shared/contracts/index.ts";

import type { ReactElement, SyntheticEvent } from "react";

function InviteStaffForm({ onInvited }: Readonly<{ onInvited: () => void }>): ReactElement {
  const action = useAction();
  const email = useTextInput();
  const [permission, setPermission] = useState<string>(STAFF_PERMISSION.viewer);
  const [notice, setNotice] = useState<string>();
  function submit(submitEvent: Readonly<Pick<SyntheticEvent, "preventDefault">>): void {
    submitEvent.preventDefault();
    if (!isStaffPermission(permission)) {
      return;
    }
    setNotice(undefined);
    action.run(async () => {
      const invited = apiData(
        StaffInvited,
        await wikiClient().staff.invites.post({ email: email.value, permission }),
      );
      setNotice(
        `${invited.email} に招待メールを送りました。${formatWarekiDate(invited.expiresAt)} まで有効です。`,
      );
      email.handleChange("");
      onInvited();
    });
  }
  return (
    <form
      aria-label="メンバーを招待する"
      aria-busy={action.pending}
      onSubmit={submit}
      className="flex flex-col gap-3 rounded-lg border border-border p-3"
    >
      <div className="flex flex-wrap items-end gap-2">
        <div className="w-full sm:w-72">
          <Field
            label="メールアドレス"
            name="email"
            type="email"
            autoComplete="off"
            required
            value={email.value}
            onValueChange={email.handleChange}
          />
        </div>
        <div className="w-48">
          <SelectField
            label="権限"
            name="permission"
            options={staffPermissionOptions}
            value={permission}
            onValueChange={setPermission}
          />
        </div>
        <Button type="submit" variant="primary" disabled={action.blocked}>
          招待メールを送る
        </Button>
      </div>
      <ActionStatus action={action} notice={notice} pendingMessage="招待メールを送っています。" />
    </form>
  );
}

export { InviteStaffForm };
