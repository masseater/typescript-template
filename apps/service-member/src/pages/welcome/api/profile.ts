import { apiData } from "@repo/runtime/client";

import { userClient } from "#shared/api/index.ts";
import { ProfileView } from "#shared/contracts/index.ts";

function saveProfile(
  name: string,
  profile: string,
  socialLinks: readonly string[],
): Promise<typeof ProfileView.Type> {
  return Promise.resolve(userClient()).then(({ api }) =>
    api.profile
      .patch({ name, profile, socialLinks })
      .then((response) => apiData(ProfileView, response)),
  );
}

export { saveProfile };
