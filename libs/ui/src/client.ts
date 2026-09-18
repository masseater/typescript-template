import { passkeyClient } from "@better-auth/passkey/client";
import { twoFactorClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

import { requirePasskeyUV } from "./protocol";

const authClient = createAuthClient({
  basePath: "/api/auth",
  fetchOptions: {
    baseURL: "/api/auth",
    credentials: "same-origin",
    customFetchImpl: async (input, init) => globalThis.fetch(input, init),
    onSuccess: ({
      data,
      response,
    }: Readonly<{ data: unknown; response: Readonly<Pick<Response, "url">> }>) => {
      requirePasskeyUV(data, new URL(response.url).pathname);
    },
    redirect: "error",
  },
  plugins: [passkeyClient(), twoFactorClient()],
});

export { authClient };
