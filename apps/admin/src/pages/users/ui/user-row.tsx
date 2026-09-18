import { TableCell, TableRow } from "@template/ui/ui";
import { roleLabels, verificationLabels } from "#pages/users/model/user-labels.ts";
import type { ListedUser } from "#pages/users/model/user-list.ts";
import type { ReactElement } from "react";
import { UserRowActions } from "./user-row-actions.tsx";

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
