import { createAuthClient } from "better-auth/react";
import { passkeyClient } from "@better-auth/passkey/client";
import { twoFactorClient } from "better-auth/client/plugins";
import { requirePasskeyUV } from "./protocol";

export const authClient = createAuthClient({
  basePath: "/api/auth",
  plugins: [passkeyClient(), twoFactorClient()],
  fetchOptions: {
    baseURL: "/api/auth",
    credentials: "same-origin",
    redirect: "error",
    customFetchImpl: (input, init) => globalThis.fetch(input, init),
    onSuccess: ({ data, response }) => {
      requirePasskeyUV(data, new URL(response.url).pathname);
    },
  },
});
