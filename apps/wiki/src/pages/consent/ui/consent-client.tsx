import { Status, resultError } from "@template/ui";
import { AsyncResult } from "effect/unstable/reactivity";
import { ConsentActions } from "./consent-actions.tsx";
import type { ReactElement } from "react";
import { useClientName } from "#pages/consent/model/client-name.ts";

function ConsentClient({ clientId }: Readonly<{ clientId: string }>): ReactElement {
  const result = useClientName(clientId);
  const error = resultError(result);
  if (error !== undefined) {
    return <Status variant="error">{error}</Status>;
  }
  if (!AsyncResult.isSuccess(result) || result.value === undefined) {
    return <Status variant="pending">読み込み中です。</Status>;
  }
  return <ConsentActions client={result.value} />;
}

export { ConsentClient };
