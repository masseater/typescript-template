import { absent, apiData, apiDataOrNone } from "@repo/runtime/client";
import { mutationOptions, queryOptions } from "@tanstack/react-query";
import { notFound } from "@tanstack/react-router";

import { userClient } from "#shared/api/index.ts";
import { ProfileView } from "#shared/contracts/index.ts";

import type { ProfileUpdate } from "#shared/contracts/index.ts";

type Profile = typeof ProfileView.Type;
type ProfileDraft = typeof ProfileUpdate.Type;

const profileKey = ["profile"] as const;

async function loadProfile(): Promise<Profile> {
  const { api } = await userClient();
  const profile = apiDataOrNone(ProfileView, await api.profile.get(), absent.notFound);
  if (profile === undefined) {
    throw notFound();
  }
  return profile;
}

async function saveProfile(draft: ProfileDraft): Promise<Profile> {
  const { api } = await userClient();
  return apiData(ProfileView, await api.profile.patch(draft));
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

export { profileKey, profileOptions, saveProfile, saveProfileOptions };
export type { Profile, ProfileDraft };
