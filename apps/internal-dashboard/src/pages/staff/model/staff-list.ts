import { useAtomRefresh, useAtomValue } from "@effect/atom-react";
import { errorMessage } from "@repo/auth-ui";
import { apiData } from "@repo/runtime/client";
import { formatWarekiDate, requestAtom, type RequestResult } from "@repo/ui";

import { wikiClient } from "#shared/api/index.ts";
import { StaffList } from "#shared/contracts/index.ts";

type StaffSummary = (typeof StaffList.Type)[number];

interface ListedStaff {
  readonly email: string;
  readonly id: string;
  readonly name: string;
  readonly permission?: StaffSummary["permission"];
  readonly registeredOn: string;
}

function listStaff(): Promise<readonly ListedStaff[]> {
  return Promise.resolve(wikiClient())
    .then(({ api }) => api.staff.get())
    .then((response) => {
      const staff = apiData(StaffList, response);
      return staff.map(({ createdAt, ...member }) => ({
        ...member,
        registeredOn: formatWarekiDate(createdAt),
      }));
    })
    .catch((failure: unknown) => {
      throw new Error(errorMessage(failure));
    });
}

const staffListAtom = requestAtom(() => listStaff());

function useStaffList(): Readonly<{
  listing: RequestResult<readonly ListedStaff[]>;
  reload: () => void;
}> {
  return { listing: useAtomValue(staffListAtom), reload: useAtomRefresh(staffListAtom) };
}

export { useStaffList };
export type { ListedStaff };
