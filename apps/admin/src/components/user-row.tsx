import type { ManagedUser, MutationMethod } from "#user-management.ts";
import type { ReactElement } from "react";
import { Td } from "smarthr-ui";
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
    <tr>
      <Td>{user.name}</Td>
      <Td>{user.email}</Td>
      <Td>{user.emailVerified ? "確認済み" : "未確認"}</Td>
      <Td>{user.role}</Td>
      <Td>
        <UserActions user={user} pending={pending} onMutation={onMutation} />
      </Td>
    </tr>
  );
}

export { UserRow };
