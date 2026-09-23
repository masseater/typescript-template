import { resultError, resultValue } from "@repo/ui";

import { useAuditList } from "#pages/audit/model/audit-list.ts";
import { AuditView } from "./audit-view.tsx";

import type { ReactElement } from "react";

function AuditPage(): ReactElement {
  const audit = useAuditList();
  return (
    <AuditView audit={audit} error={resultError(audit.listing)} page={resultValue(audit.listing)} />
  );
}

export { AuditPage };
