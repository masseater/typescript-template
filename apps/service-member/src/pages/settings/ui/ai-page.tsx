import { CheckboxField, FormColumn, Page, StatusMessage, localState } from "@repo/ui";

import type { ReactElement } from "react";

const useAssistReplies = localState(false);
const useShareUsage = localState(false);

function AiPage(): ReactElement {
  const [assistReplies, setAssistReplies] = useAssistReplies();
  const [shareUsage, setShareUsage] = useShareUsage();
  return (
    <Page title="AI と API">
      <StatusMessage>AI と API の設定はまだありません。既定は許可しない側です。</StatusMessage>
      <FormColumn>
        <CheckboxField
          checked={assistReplies}
          label="AI に下書きの提案を許可する"
          onCheckedChange={setAssistReplies}
        />
        <CheckboxField
          checked={shareUsage}
          label="利用状況を改善のために共有する"
          onCheckedChange={setShareUsage}
        />
      </FormColumn>
    </Page>
  );
}

export { AiPage };
