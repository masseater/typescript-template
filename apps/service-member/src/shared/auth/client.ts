import { apiKeyClient } from "@better-auth/api-key/client";
import { createAuthClient } from "better-auth/client";

const memberAuthClient = createAuthClient({
  basePath: "/api/auth",
  fetchOptions: {
    baseURL: "/api/auth",
    credentials: "same-origin",
    redirect: "error",
  },
  plugins: [apiKeyClient()],
});

export { memberAuthClient };
