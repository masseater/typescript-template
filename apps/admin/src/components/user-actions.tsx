import type { ManagedUser, MutationMethod } from "#user-management.ts";
import type { MouseEventHandler, ReactElement } from "react";
import { Button } from "@template/ui/ui";
import { useCallback } from "react";

function UserActions({
  onMutation,
  pending,
  user,
}: Readonly<{
  onMutation: (user: ManagedUser, method: MutationMethod) => void;
  pending: boolean;
  user: ManagedUser;
}>): ReactElement {
  const handleRoleChange = useCallback<MouseEventHandler>(() => {
    onMutation(user, "PATCH");
  }, [onMutation, user]);
  const handleDelete = useCallback<MouseEventHandler>(() => {
    onMutation(user, "DELETE");
  }, [onMutation, user]);
  const promoted = user.role === "admin";
  return (
    <div className="flex flex-wrap gap-1">
      <Button
        type="button"
        size="small"
        disabled={pending}
        aria-label={`${user.email} を${promoted ? "一般ユーザー" : "管理者"}に変更`}
        onClick={handleRoleChange}
      >
        {promoted ? "一般ユーザーに変更" : "管理者に変更"}
      </Button>
      <Button
        type="button"
        variant="danger"
        size="small"
        disabled={pending}
        aria-label={`${user.email} を削除`}
        onClick={handleDelete}
      >
        削除
      </Button>
    </div>
  );
}

export { UserActions };
