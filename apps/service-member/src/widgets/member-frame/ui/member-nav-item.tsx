import { Icon, NavigationLink } from "@repo/ui";

import type { ReactElement } from "react";
import type { MemberNavItem } from "../model/navigation.ts";

function MemberNavItemLink({
  item,
  layout,
}: Readonly<{
  item: MemberNavItem;
  layout: "rail" | "tab";
}>): ReactElement {
  const activeOptions =
    item.id === "home"
      ? ({ exact: true, includeSearch: false } as const)
      : ({ includeSearch: false } as const);
  return (
    <div className={layout === "tab" ? "min-w-0 flex-1" : undefined}>
      <NavigationLink
        to={item.to}
        variant="side"
        activeOptions={activeOptions}
        title={item.label}
        aria-label={item.label}
      >
        <span
          className={`flex items-center gap-1 ${layout === "tab" ? "flex-col justify-center" : "flex-col"}`}
        >
          <span className="relative">
            <Icon icon={item.icon} />
            {item.badge === undefined || item.badge === 0 ? null : (
              <span className="absolute -top-1 -right-2 rounded-full bg-secondary px-1 text-sm leading-none font-bold text-secondary-foreground">
                {item.badge}
              </span>
            )}
          </span>
          <span className="flex max-w-full items-center justify-center gap-1 truncate text-sm leading-none">
            <span className="truncate">{item.label}</span>
            {item.paid === true ? (
              <span className="shrink-0 font-bold text-muted-foreground">有料</span>
            ) : null}
          </span>
        </span>
      </NavigationLink>
    </div>
  );
}

export { MemberNavItemLink };
