import { ShellPage } from "#shared/ui/shell-page.tsx";

import type { ReactElement } from "react";

function NotificationsPage(): ReactElement {
  return <ShellPage title="通知" detail="届いた通知はまだありません。" />;
}

export { NotificationsPage };
