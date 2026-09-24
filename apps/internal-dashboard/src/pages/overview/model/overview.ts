import { useAtomValue } from "@effect/atom-react";
import { requestAtom, type RequestResult } from "@repo/ui";

import { loadOverview } from "#pages/overview/api/overview.ts";

import type { StaffOverviewView } from "#shared/contracts/index.ts";

const overviewAtom = requestAtom(() => loadOverview());

function useOverview(): RequestResult<StaffOverviewView> {
  return useAtomValue(overviewAtom);
}

export { useOverview };
