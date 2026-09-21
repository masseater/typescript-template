import { Page } from "@repo/ui";

import { InterviewSession } from "#widgets/interview-talk/index.ts";

import type { ReactElement } from "react";

function InterviewSettingsPage(): ReactElement {
  return (
    <Page title="AI インタビュー">
      <InterviewSession />
    </Page>
  );
}

export { InterviewSettingsPage };
