import { apiData, apiDataOrNone } from "@template/runtime/client";
import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { createIsomorphicFn, createServerFn } from "@tanstack/react-start";
import { ProfilePage } from "#pages/profile/index.ts";
import { ProfileView } from "@template/runtime/contracts";
import type { ReactElement } from "react";
import { getRequest } from "@tanstack/react-start/server";
import { treaty } from "@elysiajs/eden";
import { userApi } from "#app/api.ts";
import { userClient } from "#app/api-client.ts";

type Profile = typeof ProfileView.Type;

const loadOnServer = createServerFn({ method: "GET" }).handler(
  async (): Promise<Profile | undefined> =>
    apiDataOrNone(
      ProfileView,
      await treaty(userApi, { headers: getRequest().headers, parseDate: false }).api.profile.get(),
    ),
);

const loadProfile = createIsomorphicFn()
  .server(async (): Promise<Profile | undefined> => loadOnServer())
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
