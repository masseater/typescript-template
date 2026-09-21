import { Page } from "@repo/ui";

import { InterviewRoom } from "#widgets/interview-room/index.ts";

import type { ReactElement } from "react";

function InterviewSettingsPage(): ReactElement {
  return (
    <Page title="AI インタビュー">
      <InterviewRoom />
    </Page>
  );
}

export { InterviewSettingsPage };
