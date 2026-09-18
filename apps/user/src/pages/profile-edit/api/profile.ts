import { notFound } from "@tanstack/react-router";
import { absent, apiData, apiDataOrNone } from "@template/runtime/client";
import { ProfileView } from "@template/runtime/contracts";

import { userClient } from "#shared/api/index.ts";

type Profile = typeof ProfileView.Type;

const loadProfile = async (): Promise<Profile> => {
  const { api } = await userClient();
  const profile = apiDataOrNone(ProfileView, await api.profile.get(), absent.notFound);
  if (profile === undefined) {
    throw notFound();
  }
  return profile;
};

const saveProfile = async (name: string, profile: string): Promise<Profile> => {
  const { api } = await userClient();
  return apiData(ProfileView, await api.profile.patch({ name, profile }));
};

export { loadProfile, saveProfile };
export type { Profile };
