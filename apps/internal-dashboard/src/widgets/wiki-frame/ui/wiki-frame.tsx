import { AppChrome, ChromeSearch } from "#shared/app-chrome/index.ts";

import type { ReactElement, ReactNode, ReactPortal } from "react";

function WikiFrame({
  children,
}: Readonly<{
  children: Readonly<Exclude<ReactNode, ReactPortal>>;
}>): ReactElement {
  return (
    <div className="flex min-h-dvh flex-col bg-muted">
      <AppChrome tools={<ChromeSearch placeholder="文書を検索" />} />
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}

export { WikiFrame };
