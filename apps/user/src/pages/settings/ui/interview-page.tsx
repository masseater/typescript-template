import { Page, StatusMessage } from "@repo/ui";

import type { ReactElement } from "react";

function InterviewSettingsPage(): ReactElement {
  return (
    <Page title="AI インタビュー">
      <StatusMessage>設定からの AI インタビューはまだありません。</StatusMessage>
    </Page>
  );
}

export { InterviewSettingsPage };
