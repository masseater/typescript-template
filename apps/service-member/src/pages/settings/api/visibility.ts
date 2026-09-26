import { apiData } from "@repo/runtime/client";

import { userClient } from "#shared/api/index.ts";
import { VisibilityView } from "#shared/contracts/index.ts";

import type { Visibility } from "#entities/profile/index.ts";

function saveVisibility(values: Visibility): Promise<Visibility> {
  return Promise.resolve(userClient()).then(({ api }) =>
    api.profile.visibility.patch(values).then((response) => apiData(VisibilityView, response)),
  );
}

export { saveVisibility };
