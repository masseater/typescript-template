import { TableCell, TableRow } from "@template/ui";
import { roleLabels, verificationLabels } from "#user-labels.ts";
import type { ListedUser } from "#user-list.ts";
import type { ReactElement } from "react";
import { UserRowActions } from "#components/user-row-actions.tsx";

function UserRow({
  onChanged,
  user,
}: Readonly<{ onChanged: () => void; user: ListedUser }>): ReactElement {
  return (
    <TableRow>
      <TableCell>{user.name}</TableCell>
      <TableCell>{user.email}</TableCell>
      <TableCell>{roleLabels[user.role]}</TableCell>
      <TableCell>
        {user.emailVerified ? verificationLabels.true : verificationLabels.false}
      </TableCell>
      <TableCell>{user.twoFactorEnabled ? "設定済み" : "未設定"}</TableCell>
      <TableCell>{user.registeredOn}</TableCell>
      <TableCell>
        <UserRowActions user={user} onChanged={onChanged} />
      </TableCell>
    </TableRow>
  );
}

export { UserRow };
