import { useAtomRefresh, useAtomValue } from "@effect/atom-react";
import { errorMessage } from "@repo/auth-ui";
import { apiData } from "@repo/runtime/client";
import { formatWarekiDate, requestAtom, type RequestResult } from "@repo/ui";

import { adminClient } from "#shared/api/index.ts";
import { AdminList } from "#shared/contracts/index.ts";

type AdminSummary = (typeof AdminList.Type)[number];

interface ListedAdmin {
  readonly accountState: AdminSummary["accountState"];
  readonly email: string;
  readonly id: string;
  readonly name: string;
  readonly permission?: AdminSummary["permission"];
  readonly registeredOn: string;
}

async function listAdmins(): Promise<readonly ListedAdmin[]> {
  try {
    const admins = apiData(AdminList, await adminClient().admins.get());
    return admins.map(({ createdAt, ...admin }) => ({
      ...admin,
      registeredOn: formatWarekiDate(createdAt),
    }));
  } catch (failure) {
    throw new Error(errorMessage(failure));
  }
}

const adminListAtom = requestAtom(async () => listAdmins());

function useAdminList(): Readonly<{
  listing: RequestResult<readonly ListedAdmin[]>;
  reload: () => void;
}> {
  return { listing: useAtomValue(adminListAtom), reload: useAtomRefresh(adminListAtom) };
}

export { useAdminList };
export type { ListedAdmin };
