import { Link } from "@tanstack/react-router";
import type { ReactElement } from "react";

const activeProps = { className: "bg-accent font-bold" } as const;
const activeOptions = { exact: true, includeSearch: false } as const;

function AdminNavigationItem({
  label,
  onNavigate,
  to,
}: Readonly<{ label: string; onNavigate: () => void; to: "/" | "/security" }>): ReactElement {
  return (
    <li>
      <Link
        to={to}
        activeProps={activeProps}
        activeOptions={activeOptions}
        onClick={onNavigate}
        className="block rounded-md px-2 py-1.5 text-base leading-tight text-foreground outline-none hover:bg-card-hover focus-visible:focus-indicator"
      >
        {label}
      </Link>
    </li>
  );
}

export { AdminNavigationItem };
