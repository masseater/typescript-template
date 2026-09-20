import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuLinkItem,
  DropdownMenuTrigger,
  Icon,
  useToast,
} from "@repo/ui";
import { ChevronDownIcon } from "lucide-react";
import { useEffect, type ReactElement, type ReactNode, type ReactPortal } from "react";

import { useSignOut } from "./use-sign-out";

const AccountMenu = (
  props: Readonly<
    | {
        collapsed: boolean;
        email: string;
        name: string;
      }
    | {
        destination?: string;
        items: Readonly<Exclude<ReactNode, ReactPortal>>;
        label: string;
        trigger: Readonly<Exclude<ReactNode, ReactPortal>>;
      }
  >,
): ReactElement => {
  const identity = "email" in props;
  const accountName = identity ? props.name : props.label;
  const destination = identity ? undefined : props.destination;
  const { action, signOut } = useSignOut(destination);
  const notify = useToast();
  useEffect(() => {
    if (action.error !== undefined) {
      notify("error", action.error);
    }
  }, [action.error, notify]);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label={`${accountName} のアカウントメニュー`}>
        {identity ? (
          <>
            {props.collapsed ? null : (
              <span className="flex min-w-0 flex-col items-start text-left">
                <span className="max-w-40 truncate text-sm leading-tight font-bold">
                  {props.name}
                </span>
                <span className="max-w-40 truncate text-sm leading-tight text-muted-foreground">
                  {props.email}
                </span>
              </span>
            )}
            <Icon icon={ChevronDownIcon} size="small" />
          </>
        ) : (
          props.trigger
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {identity ? (
          <>
            <DropdownMenuLabel>{props.email}</DropdownMenuLabel>
            <DropdownMenuLinkItem to="/security">セキュリティ</DropdownMenuLinkItem>
          </>
        ) : (
          props.items
        )}
        <DropdownMenuItem disabled={action.blocked} onClick={signOut}>
          ログアウト
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export { AccountMenu };
