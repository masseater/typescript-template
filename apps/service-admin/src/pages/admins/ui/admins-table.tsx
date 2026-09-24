import { RequestTable, type RequestResult } from "@repo/ui";

import { adminsTableColumns } from "#pages/admins/model/admin-labels.ts";
import { AdminRow } from "./admin-row.tsx";

import type { ListedAdmin } from "#pages/admins/model/admin-list.ts";
import type { ReactElement } from "react";

function AdminsTable({
  listing,
  onReload,
}: Readonly<{
  listing: RequestResult<readonly ListedAdmin[]>;
  onReload: () => void;
}>): ReactElement {
  return (
    <RequestTable
      columns={adminsTableColumns}
      listing={listing}
      onReload={onReload}
      row={(admin) => <AdminRow key={admin.id} admin={admin} onChanged={onReload} />}
    />
  );
}

export { AdminsTable };
