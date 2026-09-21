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
  const className = layout === "tab" ? "px-1 py-2 text-center" : undefined;
  const body = (
    <span className="flex flex-col items-center gap-1">
      <Icon icon={item.icon} />
      {layout === "rail" ? <span className="text-sm leading-none">{item.label}</span> : null}
    </span>
  );
  return (
    <div className={layout === "tab" ? "flex-1" : undefined}>
      {item.id === "profile" ? (
        <NavigationLink
          to={item.to}
          params={item.params}
          variant="side"
          activeOptions={activeOptions}
          title={item.label}
          aria-label={item.label}
          className={className}
        >
          {body}
        </NavigationLink>
      ) : (
        <NavigationLink
          to={item.to}
          variant="side"
          activeOptions={activeOptions}
          title={item.label}
          aria-label={item.label}
          className={className}
        >
          {body}
        </NavigationLink>
      )}
    </div>
  );
}

export { MemberNavItemLink };
