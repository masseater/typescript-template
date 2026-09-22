import { absent, apiData, apiDataOrNoneFor } from "@repo/runtime/client";
import { notFound } from "@tanstack/react-router";

import { userClient } from "#shared/api/index.ts";
import { ProfileView } from "#shared/contracts/index.ts";

type Profile = typeof ProfileView.Type;

function loadProfile(): Promise<Profile> {
  return Promise.resolve(userClient()).then(({ api }) =>
    api.profile.get().then((response) => {
      const profile = apiDataOrNoneFor(absent.notFound)(ProfileView, response);
      if (profile == null) {
        throw notFound();
      }
      return profile;
    }),
  );
}

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

export { loadProfile, saveProfile };
export type { Profile };
