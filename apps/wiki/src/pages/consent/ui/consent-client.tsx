import { ConsentActions } from "./consent-actions.tsx";
import { Option } from "effect";
import type { ReactElement } from "react";
import { Status } from "@template/ui";
import { useClientName } from "#pages/consent/model/client-name.ts";

function ConsentClient({ clientId }: Readonly<{ clientId: string }>): ReactElement {
  const result = useClientName(clientId);
  if (result.status === "failure") {
    return <Status variant="error">{result.message}</Status>;
  }
  if (result.status === "pending" || Option.isNone(result.value)) {
    return <Status variant="pending">読み込み中です。</Status>;
  }
  return <ConsentActions client={result.value.value} />;
}

export { ConsentClient };
