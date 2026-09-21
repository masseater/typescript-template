import { Button, Page, useAction } from "@repo/ui";
import { useNavigate } from "@tanstack/react-router";

import { PendingAgreementList, acceptAgreements } from "#entities/agreement/index.ts";

import type { Agreements } from "#entities/agreement/index.ts";
import type { ReactElement } from "react";

function ReconsentPage({
  agreements,
  destination,
}: Readonly<{ agreements: Agreements; destination: string }>): ReactElement {
  const navigate = useNavigate();
  const action = useAction();
  const { pending } = agreements;

  return (
    <Page title="利用規約が更新されました">
      <p className="text-base leading-normal text-foreground">
        続けるには、更新された規約への同意が必要です。
      </p>
      <PendingAgreementList pending={pending} />
      <Button
        disabled={action.blocked || pending.length === 0}
        onClick={() => {
          action.run(async () => {
            await acceptAgreements(pending.map((agreement) => agreement.id));
            await navigate({ href: destination });
          });
        }}
        type="button"
        variant="primary"
      >
        同意して続ける
      </Button>
      {action.error !== undefined && <p className="text-sm text-destructive">{action.error}</p>}
    </Page>
  );
}

export { ReconsentPage };
