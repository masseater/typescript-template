import { absent, apiDataOrNone } from "@repo/runtime/client";
import { notFound } from "@tanstack/react-router";

import { userClient } from "#shared/api/index.ts";
import { ProfileView } from "#shared/contracts/index.ts";

import type { Profile } from "#shared/api/index.ts";

function loadProfile(): Promise<Profile> {
  return Promise.resolve(userClient()).then(({ api }) =>
    api.profile.get().then((response) => {
      const profile = apiDataOrNone(ProfileView, response, absent.notFound);
      if (profile === undefined) {
        throw notFound();
      }
      return profile;
    }),
  );
}

export { loadProfile };
