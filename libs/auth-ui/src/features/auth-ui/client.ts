import { passkeyClient } from "@better-auth/passkey/client";
import { createAuthClient } from "better-auth/client";
import { twoFactorClient } from "better-auth/client/plugins";
import { Effect } from "effect";

import { executeBrowserRequest } from "./browser-http.ts";

const authClient = createAuthClient({
  basePath: "/api/auth",
  fetchOptions: {
    baseURL: "/api/auth",
    credentials: "same-origin",
    customFetchImpl: (input, init) => Effect.runPromise(executeBrowserRequest(input, init)),
    redirect: "error",
  },
  plugins: [passkeyClient(), twoFactorClient()],
});

export { authClient };
