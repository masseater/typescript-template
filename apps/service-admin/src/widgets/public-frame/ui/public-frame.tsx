import { serviceName } from "#shared/config/index.ts";

import type { ReactElement, ReactNode, ReactPortal } from "react";

function PublicFrame({
  children,
}: Readonly<{ children: Readonly<Exclude<ReactNode, ReactPortal>> }>): ReactElement {
  return (
    <div className="flex min-h-screen flex-col items-center gap-4 px-4 py-12">
      <p className="text-lg leading-tight font-bold text-foreground">{serviceName}</p>
      <div className="w-full max-w-column rounded-lg border border-border bg-card shadow-sm">
        {children}
      </div>
    </div>
  );
}

export { PublicFrame };
