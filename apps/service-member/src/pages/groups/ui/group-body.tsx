import { ShellPage } from "#shared/ui/shell-page.tsx";

import type { ReactElement, ReactNode } from "react";

function GroupBody({ children }: Readonly<{ children: ReactNode }>): ReactElement {
  return <ShellPage title="グループ">{children}</ShellPage>;
}

export { GroupBody };
