import { apiData } from "@repo/runtime/client";

import { userClient } from "#shared/api/index.ts";
import { VisibilityView } from "#shared/contracts/index.ts";

type Visibility = typeof VisibilityView.Type;

async function loadVisibility(): Promise<Visibility> {
  const { api } = await userClient();
  return apiData(VisibilityView, await api.profile.visibility.get());
}

async function saveVisibility(values: Visibility): Promise<Visibility> {
  const { api } = await userClient();
  return apiData(VisibilityView, await api.profile.visibility.patch(values));
}

export { loadVisibility, saveVisibility };
export type { Visibility };
