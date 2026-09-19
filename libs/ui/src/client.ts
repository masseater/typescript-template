import { passkeyClient } from "@better-auth/passkey/client";
import { twoFactorClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

import { passkeyUVResponse } from "./passkey-uv-response.ts";

const authClient = createAuthClient({
  basePath: "/api/auth",
  fetchOptions: {
    baseURL: "/api/auth",
    credentials: "same-origin",
    customFetchImpl: async (input, init) => {
      const served = await globalThis.fetch(input, init);
      return passkeyUVResponse(served, served.url);
    },
    redirect: "error",
  },
  plugins: [passkeyClient(), twoFactorClient()],
});

export { authClient };
