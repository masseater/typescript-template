import { useDbClient, useLiveQuery } from "@tanstack/react-db";
import type { Profile } from "#entities/profile/model/profile.ts";
import { profileCollection } from "#entities/profile/api/profile-collection.ts";

function useViewerProfile(): Profile | undefined {
  const collection = useDbClient().collection(profileCollection);
  const { data } = useLiveQuery({ query: (builder) => builder.from({ profile: collection }) });
  return data[0];
}

function useEditedProfile(id: string): Profile | undefined {
  const viewer = useViewerProfile();
  return viewer?.id === id ? viewer : undefined;
}

export { useEditedProfile, useViewerProfile };
