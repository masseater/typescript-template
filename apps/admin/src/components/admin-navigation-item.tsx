import { NavigationLink } from "@template/ui";
import type { ReactElement } from "react";

const activeOptions = { exact: true, includeSearch: false } as const;

function AdminNavigationItem({
  label,
  onNavigate,
  to,
}: Readonly<{ label: string; onNavigate: () => void; to: "/" | "/security" }>): ReactElement {
  return (
    <li>
      <NavigationLink to={to} activeOptions={activeOptions} onClick={onNavigate}>
        {label}
      </NavigationLink>
    </li>
  );
}

export { AdminNavigationItem };
