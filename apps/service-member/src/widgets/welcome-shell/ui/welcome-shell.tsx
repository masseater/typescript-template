import { Outlet } from "@tanstack/react-router";

import type { ReactElement, ReactNode } from "react";

function WelcomeShell({
  children,
  progress,
}: Readonly<{ children?: ReactNode; progress: string }>): ReactElement {
  return (
    <div className="flex min-h-dvh flex-col items-center gap-6 p-4">
      <p className="text-sm leading-tight text-muted-foreground">{progress}</p>
      <div className="max-w-lg w-full">{children ?? <Outlet />}</div>
    </div>
  );
}

export { WelcomeShell };
