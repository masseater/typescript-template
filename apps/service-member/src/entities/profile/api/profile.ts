import { absent, apiData, apiDataOrNoneFor } from "@repo/runtime/client";
import { queryOptions } from "@tanstack/react-query";
import { notFound } from "@tanstack/react-router";

import { userClient } from "#shared/api/index.ts";
import { ProfileView, VisibilityView } from "#shared/contracts/index.ts";

import type { ProfileUpdate } from "#shared/contracts/index.ts";

type Profile = typeof ProfileView.Type;
type ProfileDraft = typeof ProfileUpdate.Type;
type Visibility = typeof VisibilityView.Type;

function loadProfile(): Promise<Profile> {
  return Promise.resolve(userClient()).then(({ api }) =>
    api.profile.get().then((response) => {
      const profile = apiDataOrNoneFor(absent.notFound)(ProfileView, response);
      if (profile == null) {
        throw notFound();
      }
      return profile as Profile;
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
  queryKey: ["profile"],
  retry: false,
});

function loadVisibility(): Promise<Visibility> {
  return Promise.resolve(userClient()).then(({ api }) =>
    api.profile.visibility.get().then((response) => apiData(VisibilityView, response)),
  );
}

const visibilityOptions = queryOptions({
  queryFn: loadVisibility,
  queryKey: ["profile", "visibility"],
  retry: false,
});

export { profileOptions, saveProfile, visibilityOptions };
export type { Profile, ProfileDraft, Visibility };
