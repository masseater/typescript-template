import { notFound } from "@tanstack/react-router";

import { userClient } from "#shared/api/index.ts";
import { absent, apiData, apiDataOrNone } from "@repo/runtime/client";
import { ProfileView } from "@repo/runtime/contracts";

type Profile = typeof ProfileView.Type;

async function loadProfile(): Promise<Profile> {
  const { api } = await userClient();
  const profile = apiDataOrNone(ProfileView, await api.profile.get(), absent.notFound);
  if (profile === undefined) {
    throw notFound();
  }
  return profile;
}

async function saveProfile(name: string, profile: string): Promise<Profile> {
  const { api } = await userClient();
  return apiData(ProfileView, await api.profile.patch({ name, profile }));
}

export { loadProfile, saveProfile };
export type { Profile };
