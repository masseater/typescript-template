import { useDbClient, useLiveQuery } from "@tanstack/react-db";
import type { Profile } from "#entities/profile/model/profile.ts";
import { profileCollection } from "#entities/profile/api/profile-collection.ts";
import { useHydrated } from "@template/ui";

interface ViewerProfile {
  readonly loading: boolean;
  readonly profile: Profile | undefined;
  readonly save: (name: string, profile: string) => Promise<void>;
}

function useViewerProfile(): ViewerProfile {
  const hydrated = useHydrated();
  const collection = useDbClient().collection(profileCollection);
  const { data, isLoading } = useLiveQuery({
    query: (builder) => (hydrated ? builder.from({ profile: collection }) : undefined),
  });
  const [profile] = data ?? [];
  return {
    loading: !hydrated || isLoading,
    profile,
    save: async (name: string, biography: string): Promise<void> => {
      if (profile === undefined) {
        throw new Error("プロフィールを読み込めていません。");
      }
      await collection.update(profile.id, (draft) => {
        draft.name = name;
        draft.profile = biography;
      }).isPersisted.promise;
    },
  };
}

function useEditedProfile(id: string): Profile | undefined {
  const { profile } = useViewerProfile();
  return profile?.id === id ? profile : undefined;
}

export { useEditedProfile, useViewerProfile };
