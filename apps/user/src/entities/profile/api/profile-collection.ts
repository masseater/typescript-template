import { absent, apiData, apiDataOrNone } from "@template/runtime/client";
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

async function loadProfile(): Promise<Profile[]> {
  const { api } = await userClient();
  const profile = apiDataOrNone(ProfileView, await api.profile.get(), absent.notFound);
  return profile === undefined ? [] : [profile];
}

async function saveProfile({ transaction }: ProfileUpdates): Promise<void> {
  const { api } = await userClient();
  await Promise.all(
    transaction.mutations.map(async ({ modified }) =>
      apiData(
        ProfileView,
        await api.profile.patch({ name: modified.name, profile: modified.profile }),
      ),
    ),
  );
}

const profileQuery = { queryFn: loadProfile, queryKey: ["profile"] };

const profileOptions = queryOptions(profileQuery);

const profileCollection = collectionOptions("profile", (client) =>
  queryCollectionOptions({
    ...profileQuery,
    getKey: (row: Readonly<Profile>): string => row.id,
    onUpdate: saveProfile,
    queryClient: client.requireDependency<QueryClient>("queryClient"),
  }),
);

export { profileCollection, profileOptions };
