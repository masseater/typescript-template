import { Page, Status } from "@repo/ui";

import type { ReactElement } from "react";

function InterviewSettingsPage(): ReactElement {
  return (
    <Page title="AI インタビュー">
      <Status>設定からの AI インタビューはまだありません。</Status>
    </Page>
  );
}

export { InterviewSettingsPage };
