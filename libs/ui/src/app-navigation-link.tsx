import type { ReactElement } from "react";

function AppNavigationLink({
  href,
  label,
}: Readonly<{ href: string; label: string }>): ReactElement {
  return (
    <li>
      <a href={href} className="focus-visible:focus-indicator-outer">
        {label}
      </a>
    </li>
  );
}

export { AppNavigationLink };
