import { STAFF_PERMISSION } from "@repo/config";
import { apiData } from "@repo/runtime/client";
import {
  ActionStatus,
  Button,
  Field,
  SelectField,
  formatWarekiDate,
  localState,
  useAction,
  useOptionalString,
  useTextInput,
} from "@repo/ui";
import { Option } from "effect";

import { isStaffPermission, staffPermissionOptions } from "#pages/staff/model/staff-labels.ts";
import { wikiClient } from "#shared/api/index.ts";
import { StaffInvited } from "#shared/contracts/index.ts";

import type { ReactElement, SyntheticEvent } from "react";

const usePermission = localState<string>(STAFF_PERMISSION.viewer);

function InviteStaffForm({ onInvited }: Readonly<{ onInvited: () => void }>): ReactElement {
  const action = useAction();
  const email = useTextInput();
  const [permission, setPermission] = usePermission();
  const [notice, setNotice] = useOptionalString();
  function submit(submitEvent: Readonly<Pick<SyntheticEvent, "preventDefault">>): void {
    submitEvent.preventDefault();
    if (!isStaffPermission(permission)) {
      return;
    }
    setNotice(Option.none());
    action.run(() =>
      Promise.resolve(wikiClient())
        .then(({ api }) => api.staff.invites.post({ email: email.value, permission }))
        .then((response) => {
          const invited = apiData(StaffInvited, response);
          setNotice(
            Option.some(
              `${invited.email} に招待メールを送りました。${formatWarekiDate(invited.expiresAt)} まで有効です。`,
            ),
          );
          email.handleChange("");
          onInvited();
        }),
    );
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
      <ActionStatus
        action={action}
        notice={Option.getOrUndefined(notice)}
        pendingMessage="招待メールを送っています。"
      />
    </form>
  );
}

export { InviteStaffForm };
