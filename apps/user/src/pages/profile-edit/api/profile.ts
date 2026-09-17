import { absence, findApi } from "#shared/api/index.ts";
import { ProfileView } from "@template/runtime/contracts";
import { notFound } from "@tanstack/react-router";
import { requestJson } from "@template/runtime/client";

type Profile = typeof ProfileView.Type;

async function loadProfile(): Promise<Profile> {
  const profile = await findApi("/api/profile", ProfileView, absence.notFound);
  if (profile === undefined) {
    throw notFound();
  }
  return profile;
}

async function saveProfile(name: string, profile: string): Promise<Profile> {
  return requestJson("/api/profile", ProfileView, { body: { name, profile }, method: "PATCH" });
}

export { loadProfile, saveProfile };
export type { Profile };
