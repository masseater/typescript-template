import { Page, StatusMessage } from "@repo/ui";
import { useRouter } from "@tanstack/react-router";

import { HistoryConsentPanel } from "./history-consent-panel.tsx";

import type { InterviewView } from "#shared/contracts/index.ts";
import type { ReactElement } from "react";

function InterviewSettingsPage({
  interview,
}: Readonly<{ interview: typeof InterviewView.Type }>): ReactElement {
  const router = useRouter();

  if (interview.phase === "history_consent") {
    return (
      <Page title="AI インタビュー">
        <HistoryConsentPanel
          onResponded={async () => {
            await router.invalidate();
          }}
        />
      </Page>
    );
  }

  return (
    <Page title="AI インタビュー">
      <StatusMessage>設定からの AI インタビューはまだありません。</StatusMessage>
    </Page>
  );
}

export { InterviewSettingsPage };
