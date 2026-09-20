import { errorMessage } from "@repo/auth-ui";
import { apiData } from "@repo/runtime/client";
import { formatWarekiDate } from "@repo/ui";
import { useEffect, useState } from "react";

import { wikiClient } from "#shared/api/index.ts";
import { StaffList } from "#shared/contracts/index.ts";

type StaffSummary = (typeof StaffList.Type)[number];

interface ListedStaff {
  readonly email: string;
  readonly id: string;
  readonly name: string;
  readonly permission: StaffSummary["permission"];
  readonly registeredOn: string;
}

type StaffListState =
  | Readonly<{ message: string; status: "failed" }>
  | Readonly<{ staff: readonly ListedStaff[]; status: "loaded" }>
  | Readonly<{ status: "loading" }>;

async function fetchStaff(): Promise<StaffListState> {
  try {
    const staff = apiData(StaffList, await wikiClient().staff.get());
    return {
      staff: staff.map(({ createdAt, ...member }) => ({
        ...member,
        registeredOn: formatWarekiDate(createdAt),
      })),
      status: "loaded",
    };
  } catch (error) {
    return { message: errorMessage(error), status: "failed" };
  }
}

function useStaffList(): Readonly<{ reload: () => void; state: StaffListState }> {
  const [attempt, setAttempt] = useState(0);
  const [outcome, setOutcome] = useState<Readonly<{ attempt: number; state: StaffListState }>>();
  useEffect(() => {
    const controller = { active: true };
    async function load(): Promise<void> {
      const state = await fetchStaff();
      if (controller.active) {
        setOutcome({ attempt, state });
      }
    }
    void load();
    return (): void => {
      controller.active = false;
    };
  }, [attempt]);
  function reload(): void {
    setAttempt((current) => current + 1);
  }
  return {
    reload,
    state: outcome?.attempt === attempt ? outcome.state : { status: "loading" },
  };
}

export { useStaffList };
export type { ListedStaff, StaffListState };
