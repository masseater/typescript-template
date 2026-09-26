import { useAtomRefresh, useAtomValue } from "@effect/atom-react";
import { errorMessage } from "@repo/auth-ui";
import { apiData } from "@repo/runtime/client";
import { requestAtom, type RequestResult } from "@repo/ui";

import { adminClient } from "#shared/api/index.ts";
import { AdminList } from "#shared/contracts/index.ts";

type AdminSummary = (typeof AdminList.Type)[number];

interface ListedAdmin {
  readonly accountState: AdminSummary["accountState"];
  readonly createdAt: Date;
  readonly email: string;
  readonly id: string;
  readonly name: string;
  readonly permission?: AdminSummary["permission"];
}

function listAdmins(): Promise<readonly ListedAdmin[]> {
  return adminClient()
    .admins.get()
    .then((response) => apiData(AdminList, response))
    .catch((failure: unknown) => {
      throw new Error(errorMessage(failure));
    });
}

const adminListAtom = requestAtom(() => listAdmins());

function useAdminList(): Readonly<{
  listing: RequestResult<readonly ListedAdmin[]>;
  reload: () => void;
}> {
  return { listing: useAtomValue(adminListAtom), reload: useAtomRefresh(adminListAtom) };
}

export { useAdminList };
export type { ListedAdmin };
