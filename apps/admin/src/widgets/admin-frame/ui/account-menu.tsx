import { ChevronDownIcon } from "lucide-react";
import type { ReactElement } from "react";
import { useEffect } from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  Icon,
  useSignOut,
  useToast,
} from "@template/ui";

function AccountMenu({ email }: Readonly<{ email: string }>): ReactElement {
  const { action, signOut } = useSignOut();
  const notify = useToast();
  useEffect(() => {
    if (action.error !== undefined) {
      notify("error", action.error);
    }
  }, [action.error, notify]);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label={`${email} のアカウントメニュー`}>
        <span className="max-w-48 truncate">{email}</span>
        <Icon icon={ChevronDownIcon} size="small" />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>{email}</DropdownMenuLabel>
        <DropdownMenuItem disabled={action.blocked} onClick={signOut}>
          ログアウト
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { AccountMenu };
