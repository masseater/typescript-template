import { createAuthClient } from "better-auth/react";
import { passkeyClient } from "@better-auth/passkey/client";
import { requirePasskeyUV } from "./protocol";
import { twoFactorClient } from "better-auth/client/plugins";

const authClient = createAuthClient({
  basePath: "/api/auth",
  fetchOptions: {
    baseURL: "/api/auth",
    credentials: "same-origin",
    customFetchImpl: async (input, init) => globalThis.fetch(input, init),
    onSuccess: ({ data, response }) => {
      requirePasskeyUV(data, new URL(response.url).pathname);
    },
    redirect: "error",
  },
  plugins: [passkeyClient(), twoFactorClient()],
});

export { authClient };
