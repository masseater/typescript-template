import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Icon,
} from "@repo/ui";
import { EllipsisIcon } from "lucide-react";

import { stateChangeLabels } from "#pages/users/model/user-labels.ts";

import type { ListedUser } from "#pages/users/model/user-list.ts";
import type { ReactElement } from "react";

function RowActionMenu({
  disabled,
  onDelete,
  onStateChange,
  user,
}: Readonly<{
  disabled: boolean;
  onDelete: () => void;
  onStateChange: () => void;
  user: ListedUser;
}>): ReactElement {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label={`${user.email} の操作`} disabled={disabled}>
        <Icon icon={EllipsisIcon} size="small" />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={onStateChange}>
          {stateChangeLabels[user.accountState]}
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onClick={onDelete}>
          削除
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { RowActionMenu };
