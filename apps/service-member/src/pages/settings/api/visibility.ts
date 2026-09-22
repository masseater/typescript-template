import { apiData } from "@repo/runtime/client";

import { userClient } from "#shared/api/index.ts";
import { VisibilityView } from "#shared/contracts/index.ts";

import type { ApiReply } from "@repo/runtime/client";

type Visibility = typeof VisibilityView.Type;

function loadVisibility(): Promise<Visibility> {
  return Promise.resolve(userClient()).then(({ api }) =>
    api.profile.visibility.get().then((response: ApiReply) => apiData(VisibilityView, response)),
  );
}

function saveVisibility(values: Visibility): Promise<Visibility> {
  return Promise.resolve(userClient()).then(({ api }) =>
    api.profile.visibility
      .patch(values)
      .then((response: ApiReply) => apiData(VisibilityView, response)),
  );
}

export { loadVisibility, saveVisibility };
export type { Visibility };
