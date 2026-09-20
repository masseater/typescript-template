import { apiData } from "@repo/runtime/client";

import { userClient } from "#shared/api/index.ts";
import { ProfileView } from "#shared/contracts/index.ts";

async function saveProfile(
  name: string,
  profile: string,
  socialLinks: readonly string[],
): Promise<typeof ProfileView.Type> {
  const { api } = await userClient();
  return apiData(ProfileView, await api.profile.patch({ name, profile, socialLinks }));
}

export { saveProfile };
