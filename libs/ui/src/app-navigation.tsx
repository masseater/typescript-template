import { Fragment } from "react";
import type { ReactElement } from "react";

interface NavigationLink {
  readonly href: string;
  readonly label: string;
}

function AppNavigation({ links }: Readonly<{ links: readonly NavigationLink[] }>): ReactElement {
  return (
    <nav aria-label="メイン">
      {links.map((link, index) => (
        <Fragment key={link.href}>
          {index > 0 && " "}
          <a href={link.href}>{link.label}</a>
        </Fragment>
      ))}
    </nav>
  );
}

export { AppNavigation };
export type { NavigationLink };
