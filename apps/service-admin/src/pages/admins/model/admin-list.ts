import { errorMessage } from "@repo/auth-ui";
import { apiData } from "@repo/runtime/client";
import { formatWarekiDate } from "@repo/ui";
import { useEffect, useState } from "react";

import { adminClient } from "#shared/api/index.ts";
import { AdminList } from "#shared/contracts/index.ts";

type AdminSummary = (typeof AdminList.Type)[number];

interface ListedAdmin {
  readonly accountState: AdminSummary["accountState"];
  readonly email: string;
  readonly id: string;
  readonly name: string;
  readonly permission: AdminSummary["permission"];
  readonly registeredOn: string;
}

type AdminListState =
  | Readonly<{ admins: readonly ListedAdmin[]; status: "loaded" }>
  | Readonly<{ message: string; status: "failed" }>
  | Readonly<{ status: "loading" }>;

async function fetchAdmins(): Promise<AdminListState> {
  try {
    const admins = apiData(AdminList, await adminClient().admins.get());
    return {
      admins: admins.map(({ createdAt, ...admin }) => ({
        ...admin,
        registeredOn: formatWarekiDate(createdAt),
      })),
      status: "loaded",
    };
  } catch (error) {
    return { message: errorMessage(error), status: "failed" };
  }
}

function useAdminList(): Readonly<{ reload: () => void; state: AdminListState }> {
  const [attempt, setAttempt] = useState(0);
  const [outcome, setOutcome] = useState<Readonly<{ attempt: number; state: AdminListState }>>();
  useEffect(() => {
    const controller = { active: true };
    async function load(): Promise<void> {
      const state = await fetchAdmins();
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

export { useAdminList };
export type { AdminListState, ListedAdmin };
