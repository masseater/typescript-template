import { ShellPage } from "#shared/ui/shell-page.tsx";

import type { ReactElement, ReactNode } from "react";

function ConversationBody({ children }: Readonly<{ children: ReactNode }>): ReactElement {
  return <ShellPage title="会話">{children}</ShellPage>;
}

export { ConversationBody };
