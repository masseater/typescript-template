import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@template/ui/ui";
import { nextRoles, roleLabels } from "#user-labels.ts";
import { EllipsisIcon } from "lucide-react";
import type { ListedUser } from "#user-list.ts";
import type { ReactElement } from "react";

function RowActionMenu({
  disabled,
  onDelete,
  onRoleChange,
  user,
}: Readonly<{
  disabled: boolean;
  onDelete: () => void;
  onRoleChange: () => void;
  user: ListedUser;
}>): ReactElement {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label={`${user.email} の操作`} disabled={disabled}>
        <EllipsisIcon aria-hidden="true" className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={onRoleChange}>
          {`${roleLabels[nextRoles[user.role]]}にする`}
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onClick={onDelete}>
          削除
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { RowActionMenu };
