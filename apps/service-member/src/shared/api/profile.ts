import { apiData } from "@repo/runtime/client";

import { ProfileView } from "#shared/contracts/index.ts";
import { userClient } from "./client.ts";

type Profile = typeof ProfileView.Type;

function saveProfile(
  name: string,
  profile: string,
  socialLinks: readonly string[],
): Promise<Profile> {
  return Promise.resolve(userClient()).then(({ api }) =>
    api.profile
      .patch({ name, profile, socialLinks })
      .then((response) => apiData(ProfileView, response)),
  );
}

export { saveProfile };
export type { Profile };
