import { createIsomorphicFn, createServerFn } from "@tanstack/react-start";
import { ProfilePage } from "#components/profile-page.tsx";
import { ProfileView } from "@template/runtime/contracts";
import { apiDataOrNone } from "@template/runtime/client";
import { createFileRoute } from "@tanstack/react-router";
import { getRequest } from "@tanstack/react-start/server";
import { treaty } from "@elysiajs/eden";
import { userApi } from "#api.ts";
import { userClient } from "#api-client.ts";

type Profile = typeof ProfileView.Type;

const loadOnServer = createServerFn({ method: "GET" }).handler(
  async (): Promise<Profile | undefined> =>
    apiDataOrNone(
      ProfileView,
      await treaty(userApi, { headers: getRequest().headers }).api.profile.get(),
    ),
);

const loadProfile = createIsomorphicFn()
  .server(async (): Promise<Profile | undefined> => loadOnServer())
  .client(async (): Promise<Profile | undefined> =>
    apiDataOrNone(ProfileView, await userClient().profile.get()),
  );

const Route = createFileRoute("/")({ component: ProfilePage, loader: loadProfile });

export { Route };
