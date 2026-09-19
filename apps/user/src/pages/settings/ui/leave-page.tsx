import { Button, ConfirmDialog, FormColumn, Page, StatusMessage } from "@repo/ui";
import { useState } from "react";

import type { ReactElement } from "react";

function LeavePage(): ReactElement {
  const [confirming, setConfirming] = useState(false);
  return (
    <Page title="退会">
      <StatusMessage>退会の手続きはまだありません。</StatusMessage>
      <FormColumn>
        <Button type="button" variant="primary" onClick={() => setConfirming(true)}>
          退会する
        </Button>
      </FormColumn>
      <ConfirmDialog
        open={confirming}
        title="退会しますか？"
        description="アカウントを退会します。退会後 30 日間は復旧できます。"
        confirmLabel="退会する"
        onConfirm={() => setConfirming(false)}
        onOpenChange={setConfirming}
      />
    </Page>
  );
}

export { LeavePage };
