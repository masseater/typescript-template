import { absent, apiData, apiDataOrNone } from "@repo/runtime/client";
import { mutationOptions, queryOptions } from "@tanstack/react-query";
import { notFound } from "@tanstack/react-router";

import { userClient } from "#shared/api/index.ts";
import { ProfileView } from "#shared/contracts/index.ts";

import type { ProfileUpdate } from "#shared/contracts/index.ts";

type Profile = typeof ProfileView.Type;
type ProfileDraft = typeof ProfileUpdate.Type;

const profileKey = ["profile"] as const;

function loadProfile(): Promise<Profile> {
  return Promise.resolve(userClient()).then(({ api }) =>
    api.profile.get().then((response) => {
      const profile = apiDataOrNone(ProfileView, response, absent.notFound);
      if (profile === undefined) {
        throw notFound();
      }
      return profile;
    }),
  );
}

function saveProfile(draft: ProfileDraft): Promise<Profile> {
  return Promise.resolve(userClient()).then(({ api }) =>
    api.profile.patch(draft).then((response) => apiData(ProfileView, response)),
  );
}

const profileOptions = queryOptions({
  queryFn: loadProfile,
  queryKey: profileKey,
  retry: false,
});

const saveProfileOptions = mutationOptions({
  mutationFn: saveProfile,
  mutationKey: ["profile", "save"],
});

export { loadProfile, profileKey, profileOptions, saveProfile, saveProfileOptions };
export type { Profile, ProfileDraft };
