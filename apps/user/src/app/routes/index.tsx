import { apiData, apiDataOrNone, apiServerClient } from "@template/runtime/client";
import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { ProfilePage } from "#pages/profile/index.ts";
import { ProfileView } from "@template/runtime/contracts";
import type { ReactElement } from "react";
import { createIsomorphicFn } from "@tanstack/react-start";
import { userClient } from "#app/api-client.ts";

type Profile = typeof ProfileView.Type;

const loadProfile = createIsomorphicFn()
  .server(async (): Promise<Profile | undefined> => {
    const [{ userApi }, { getRequest }] = await Promise.all([
      import("#app/api.ts"),
      import("@tanstack/react-start/server"),
    ]);
    const headers = { cookie: getRequest().headers.get("cookie") ?? "" };
    return apiDataOrNone(ProfileView, await apiServerClient(userApi, headers).api.profile.get());
  })
  .client(async (): Promise<Profile | undefined> =>
    apiDataOrNone(ProfileView, await userClient().profile.get()),
  );

async function saveProfile(name: string, profile: string): Promise<Profile> {
  return apiData(ProfileView, await userClient().profile.patch({ name, profile }));
}

const route = getRouteApi("/");

const Route = createFileRoute("/")({
  component: (): ReactElement => <ProfilePage profile={route.useLoaderData()} save={saveProfile} />,
  loader: loadProfile,
});

export { Route };
