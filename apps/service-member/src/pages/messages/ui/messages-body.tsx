import { ShellPage } from "#shared/ui/shell-page.tsx";

import type { ReactElement, ReactNode } from "react";

function MessagesBody({ children }: Readonly<{ children: ReactNode }>): ReactElement {
  return <ShellPage title="メッセージ">{children}</ShellPage>;
}

export { MessagesBody };
