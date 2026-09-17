import { AppNavigationLink } from "./app-navigation-link";
import type { ReactElement } from "react";

interface NavigationLink {
  readonly href: string;
  readonly label: string;
}

function AppNavigation({ links }: Readonly<{ links: readonly NavigationLink[] }>): ReactElement {
  return (
    <nav aria-label="メイン" className="border-b border-border bg-card shadow-sm">
      <ul className="mx-auto flex w-full max-w-3xl flex-wrap items-center gap-4 p-4">
        {links.map((link) => (
          <AppNavigationLink key={link.href} href={link.href} label={link.label} />
        ))}
      </ul>
    </nav>
  );
}

export { AppNavigation };
