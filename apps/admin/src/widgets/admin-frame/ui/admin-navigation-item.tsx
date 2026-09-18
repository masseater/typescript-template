import type { ReactElement } from "react";

import { NavigationLink } from "@template/ui";

const activeOptions = { exact: true, includeSearch: false } as const;

function AdminNavigationItem({
  label,
  onNavigate,
  to,
}: Readonly<{ label: string; onNavigate: () => void; to: "/" | "/security" }>): ReactElement {
  return (
    <li>
      {/* oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <NavigationLink to={to} variant="side" activeOptions={activeOptions} onClick={onNavigate}>
        {label}
      </NavigationLink>
    </li>
  );
}

export { AdminNavigationItem };
