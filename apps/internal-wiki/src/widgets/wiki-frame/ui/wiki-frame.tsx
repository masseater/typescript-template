import { ButtonAnchor, NavigationLink } from "@repo/ui";

import type { ReactElement, ReactNode, ReactPortal } from "react";

function WikiFrame({
  children,
}: Readonly<{
  children: Readonly<Exclude<ReactNode, ReactPortal>>;
}>): ReactElement {
  return (
    <div className="flex min-h-dvh flex-col bg-muted">
      <header className="flex flex-wrap items-center gap-3 border-b border-border bg-card px-4 py-2">
        <NavigationLink to="/wiki" variant="brand">
          {"Wiki"}
        </NavigationLink>
        <div className="ml-auto">
          <ButtonAnchor href="/" variant="secondary">
            {"ダッシュボード"}
          </ButtonAnchor>
        </div>
      </header>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}

export { WikiFrame };
