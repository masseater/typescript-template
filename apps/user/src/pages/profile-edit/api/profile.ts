import { absence, readApi, writeApi } from "#shared/api/index.ts";
import { ProfileView } from "@template/runtime/contracts";
import { notFound } from "@tanstack/react-router";

type Profile = typeof ProfileView.Type;

async function loadProfile(): Promise<Profile> {
  const profile = await readApi("/api/profile", ProfileView, absence.notFound);
  if (profile === undefined) {
    throw notFound();
  }
  return profile;
}

async function saveProfile(name: string, profile: string): Promise<Profile> {
  return writeApi("/api/profile", ProfileView, { name, profile });
}

export { loadProfile, saveProfile };
export type { Profile };
