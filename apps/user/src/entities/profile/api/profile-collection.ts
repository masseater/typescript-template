import { apiData, apiDataOrNone } from "@template/runtime/client";
import type { DbClient } from "@tanstack/react-db";
import type { Profile } from "#entities/profile/model/profile.ts";
import { ProfileView } from "@template/runtime/contracts";
import type { QueryClient } from "@tanstack/react-query";
import { collectionOptions } from "@tanstack/react-db";
import { queryCollectionOptions } from "@tanstack/query-db-collection";
import { queryOptions } from "@tanstack/react-query";
import { userClient } from "#shared/api/index.ts";

interface ProfileUpdates {
  readonly transaction: Readonly<{ mutations: readonly Readonly<{ modified: Profile }>[] }>;
}

const profileKey = ["profile"];

async function loadProfile(): Promise<Profile[]> {
  const { api } = await userClient();
  const profile = apiDataOrNone(ProfileView, await api.profile.get());
  return profile === undefined ? [] : [profile];
}

async function saveProfile(profile: Profile): Promise<void> {
  const { api } = await userClient();
  apiData(ProfileView, await api.profile.patch({ name: profile.name, profile: profile.profile }));
}

async function saveUpdates({ transaction }: ProfileUpdates): Promise<{ refetch: boolean }> {
  await Promise.all(transaction.mutations.map(async ({ modified }) => saveProfile(modified)));
  return { refetch: false };
}

const profileOptions = queryOptions({ queryFn: loadProfile, queryKey: profileKey });

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
const profileCollection = collectionOptions("profile", (client: DbClient) =>
  queryCollectionOptions({
    getKey: (row: Readonly<Profile>): string => row.id,
    onUpdate: saveUpdates,
    queryClient: client.requireDependency<QueryClient>("queryClient"),
    queryFn: loadProfile,
    queryKey: profileKey,
  }),
);

export { profileCollection, profileOptions };
