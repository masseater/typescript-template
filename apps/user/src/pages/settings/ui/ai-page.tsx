import { CheckboxField, FormColumn, Page, StatusMessage } from "@repo/ui";
import { useState } from "react";

import type { ReactElement } from "react";

function AiPage(): ReactElement {
  const [assistReplies, setAssistReplies] = useState(false);
  const [shareUsage, setShareUsage] = useState(false);
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
