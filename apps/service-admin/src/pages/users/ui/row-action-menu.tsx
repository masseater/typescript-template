import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Icon,
} from "@repo/ui";
import { EllipsisIcon } from "lucide-react";

import { nextRoles, roleLabels } from "#pages/users/model/user-labels.ts";

import type { ListedUser } from "#pages/users/model/user-list.ts";
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
        <Icon icon={EllipsisIcon} size="small" />
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
