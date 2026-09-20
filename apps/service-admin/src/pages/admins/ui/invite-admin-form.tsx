import { ADMIN_PERMISSION } from "@repo/config";
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

import { adminPermissionOptions } from "#pages/admins/model/admin-labels.ts";
import { adminClient } from "#shared/api/index.ts";
import { AdminInvited, AdminPermission } from "#shared/contracts/index.ts";

import type { ReactElement, SyntheticEvent } from "react";

const isAdminPermission = (value: string): value is typeof AdminPermission.Type =>
  AdminPermission.literals.some((permission) => permission === value);

function InviteAdminForm({ onInvited }: Readonly<{ onInvited: () => void }>): ReactElement {
  const action = useAction();
  const email = useTextInput();
  const [permission, setPermission] = useState<string>(ADMIN_PERMISSION.viewer);
  const [notice, setNotice] = useState<string>();
  function submit(submitEvent: Readonly<Pick<SyntheticEvent, "preventDefault">>): void {
    submitEvent.preventDefault();
    if (!isAdminPermission(permission)) {
      return;
    }
    setNotice(undefined);
    action.run(async () => {
      const invited = apiData(
        AdminInvited,
        await adminClient().admins.invites.post({ email: email.value, permission }),
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
      aria-label="管理者を招待する"
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
            options={adminPermissionOptions}
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

export { InviteAdminForm };
