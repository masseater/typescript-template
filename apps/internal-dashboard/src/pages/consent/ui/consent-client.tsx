import { STATUS_VARIANT, StatusMessage, resultError } from "@repo/ui";
import { AsyncResult } from "effect/unstable/reactivity";

import { useClientName } from "#pages/consent/model/client-name.ts";
import { ConsentActions } from "./consent-actions.tsx";

import type { ReactElement } from "react";

function ConsentClient({ clientId }: Readonly<{ clientId: string }>): ReactElement {
  const clientName = useClientName(clientId);
  const failure = resultError(clientName);
  if (failure !== undefined) {
    return <StatusMessage variant={STATUS_VARIANT.failure}>{failure}</StatusMessage>;
  }
  if (!AsyncResult.isSuccess(clientName) || clientName.value === undefined) {
    return <StatusMessage variant={STATUS_VARIANT.pending}>読み込み中です。</StatusMessage>;
  }
  return <ConsentActions client={clientName.value} />;
}

export { ConsentClient };
