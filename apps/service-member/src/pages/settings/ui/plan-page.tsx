import { Button, ConfirmDialog, FormColumn, Page, StatusMessage, localState } from "@repo/ui";

import type { ReactElement } from "react";

const usePlanConfirming = localState(false);

function PlanPage(): ReactElement {
  const [confirming, setConfirming] = usePlanConfirming();
  return (
    <Page title="プランと解約">
      <StatusMessage>有料プランの契約と解約はまだありません。</StatusMessage>
      <FormColumn>
        <Button type="button" variant="primary" onClick={() => setConfirming(true)}>
          解約する
        </Button>
      </FormColumn>
      <ConfirmDialog
        open={confirming}
        title="解約しますか？"
        description="有料プランを解約します。解約後は無料プランになります。"
        confirmLabel="解約する"
        onConfirm={() => setConfirming(false)}
        onOpenChange={setConfirming}
      />
    </Page>
  );
}

export { PlanPage };
