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
  const name = item.paid === true ? `${item.label}（有料）` : item.label;
  return (
    <div className={layout === "tab" ? "flex-1" : undefined}>
      <NavigationLink
        to={item.to}
        variant="side"
        activeOptions={activeOptions}
        title={name}
        aria-label={name}
        {...(layout === "tab" ? { className: "px-1 py-2 text-center" } : {})}
      >
        <span className="flex flex-col items-center gap-1">
          <span className="relative">
            <Icon icon={item.icon} />
            {item.badge === undefined || item.badge === 0 ? null : (
              <span className="absolute -top-1 -right-2 rounded-full bg-secondary px-1 text-sm leading-none font-bold text-secondary-foreground">
                {item.badge}
              </span>
            )}
          </span>
          {layout === "rail" ? (
            <span className="flex items-center justify-center gap-1 text-sm leading-none">
              <span>{item.label}</span>
              {item.paid === true ? (
                <span className="font-bold text-muted-foreground">有料</span>
              ) : null}
            </span>
          ) : item.paid === true ? (
            <span className="text-sm leading-none font-bold text-muted-foreground">有料</span>
          ) : null}
        </span>
      </NavigationLink>
    </div>
  );
}

export { MemberNavItemLink };
