import { Button, ConfirmDialog, FormColumn, Page, Status } from "@repo/ui";
import { useState } from "react";

import type { ReactElement } from "react";

function PlanPage(): ReactElement {
  const [confirming, setConfirming] = useState(false);
  return (
    <Page title="プランと解約">
      <Status>有料プランの契約と解約はまだありません。</Status>
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
