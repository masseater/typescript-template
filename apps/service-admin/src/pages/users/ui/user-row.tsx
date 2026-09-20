import { NavigationLink, TableCell, TableRow } from "@repo/ui";

import { roleLabels, verificationLabels } from "#pages/users/model/user-labels.ts";
import { UserRowActions } from "./user-row-actions.tsx";

import type { ListedUser } from "#pages/users/model/user-list.ts";
import type { ReactElement } from "react";

function UserRow({
  onChanged,
  user,
}: Readonly<{ onChanged: () => void; user: ListedUser }>): ReactElement {
  return (
    <TableRow>
      <TableCell>
        <NavigationLink to="/members/$id" params={{ id: user.id }} variant="item">
          {user.name}
        </NavigationLink>
      </TableCell>
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
