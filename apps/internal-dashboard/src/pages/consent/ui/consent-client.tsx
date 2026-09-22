import { Button, STATUS_VARIANT, StatusMessage } from "@repo/ui";

import { useClientName } from "#pages/consent/model/client-name.ts";
import { ConsentActions } from "./consent-actions.tsx";

import type { ReactElement } from "react";

function ConsentClient({ clientId }: Readonly<{ clientId: string }>): ReactElement {
  const clientName = useClientName(clientId);
  const retry = (): void => {
    void clientName.refetch();
  };
  if (clientName.isError) {
    return (
      <div className="flex flex-col items-start gap-2">
        <StatusMessage variant={STATUS_VARIANT.failure}>{clientName.error.message}</StatusMessage>
        <Button onClick={retry} type="button" variant="secondary">
          再試行
        </Button>
      </div>
    );
  }
  if (clientName.data === undefined) {
    return <StatusMessage variant={STATUS_VARIANT.pending}>読み込み中です。</StatusMessage>;
  }
  return <ConsentActions client={clientName.data} />;
}

export { ConsentClient };
