import { RequestTable, type RequestResult } from "@repo/ui";

import { staffTableColumns } from "#pages/staff/model/staff-labels.ts";
import { StaffRow } from "./staff-row.tsx";

import type { ListedStaff } from "#pages/staff/model/staff-list.ts";
import type { ReactElement } from "react";

function StaffTable({
  listing,
  onReload,
}: Readonly<{
  listing: RequestResult<readonly ListedStaff[]>;
  onReload: () => void;
}>): ReactElement {
  return (
    <RequestTable
      columns={staffTableColumns}
      listing={listing}
      onReload={onReload}
      row={(member) => <StaffRow key={member.id} member={member} onChanged={onReload} />}
    />
  );
}

export { StaffTable };
