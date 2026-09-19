import { ShellPage } from "#shared/ui/shell-page.tsx";

import type { ReactElement } from "react";

function MessagesPage(): ReactElement {
  return <ShellPage title="メッセージ" detail="メッセージのやりとりはまだありません。" />;
}

export { MessagesPage };
