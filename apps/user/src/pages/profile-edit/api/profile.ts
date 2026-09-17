import { ProfileView } from "@template/runtime/contracts";
import { readApi } from "#shared/api/index.ts";
import { requestJson } from "@template/runtime/client";

type Profile = typeof ProfileView.Type;

const notFound = 404;

async function loadProfile(): Promise<Profile> {
  const profile = await readApi("/api/profile", ProfileView, notFound);
  if (profile === undefined) {
    throw new Error("プロフィールが見つかりません。");
  }
  return profile;
}

async function saveProfile(name: string, profile: string): Promise<Profile> {
  return requestJson("/api/profile", ProfileView, { body: { name, profile }, method: "PATCH" });
}

export { loadProfile, saveProfile };
export type { Profile };
