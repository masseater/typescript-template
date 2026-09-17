import type { ManagedUser, MutationMethod } from "#user-management.ts";
import { TableCell, TableRow } from "@template/ui/ui";
import type { ReactElement } from "react";
import { UserActions } from "#components/user-actions.tsx";

function UserRow({
  onMutation,
  pending,
  user,
}: Readonly<{
  onMutation: (user: ManagedUser, method: MutationMethod) => void;
  pending: boolean;
  user: ManagedUser;
}>): ReactElement {
  return (
    <TableRow>
      <TableCell>{user.name}</TableCell>
      <TableCell>{user.email}</TableCell>
      <TableCell>{user.emailVerified ? "確認済み" : "未確認"}</TableCell>
      <TableCell>{user.role}</TableCell>
      <TableCell>
        <UserActions user={user} pending={pending} onMutation={onMutation} />
      </TableCell>
    </TableRow>
  );
}

export { UserRow };
