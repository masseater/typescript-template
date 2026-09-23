import { Button, FormColumn, Page, StatusMessage } from "@repo/ui";

import { useRecoveryChoice } from "#pages/recovery/model/recovery-choice.ts";
import { memberRetentionDays } from "#shared/contracts/index.ts";

import type { ReactElement } from "react";

function RecoveryChoice({
  onDecided,
  previousName,
}: Readonly<{
  onDecided: () => void;
  previousName: string;
}>): ReactElement {
  const choice = useRecoveryChoice(onDecided);
  return (
    <Page title="過去のデータの復旧">
      <StatusMessage>
        退会から {memberRetentionDays} 日以内のため、以前のプロフィール（{previousName}
        ）を復旧できます。復旧しない場合は、新しい会員として続けます。
      </StatusMessage>
      <FormColumn>
        <Button
          type="button"
          variant="primary"
          disabled={choice.blocked}
          onClick={choice.handleAccept}
        >
          過去のデータを復旧する
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={choice.blocked}
          onClick={choice.handleDecline}
        >
          新しい会員として続ける
        </Button>
        {choice.error.length > 0 ? <StatusMessage>{choice.error}</StatusMessage> : null}
      </FormColumn>
    </Page>
  );
}

export { RecoveryChoice };
