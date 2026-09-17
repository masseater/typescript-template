import type { UserList, UserManagement } from "#user-management.ts";
import { Button } from "smarthr-ui";
import type { ReactElement } from "react";
import { UsersTable } from "#components/users-table.tsx";
import { usersPageSize } from "#users-pagination.ts";

function UserDirectory({
  list,
  management,
}: Readonly<{ list: UserList; management: UserManagement }>): ReactElement {
  return (
    <>
      <UsersTable
        users={list.users}
        pending={management.pending}
        onMutation={management.handleMutation}
      />
      <p>{list.total} 件</p>
      <Button
        type="button"
        disabled={management.offset === 0 || management.pending}
        onClick={management.handlePrevious}
      >
        前へ
      </Button>
      <Button
        type="button"
        disabled={management.offset + usersPageSize >= list.total || management.pending}
        onClick={management.handleNext}
      >
        次へ
      </Button>
    </>
  );
}

export { UserDirectory };
