import { apiKeyClient } from "@better-auth/api-key/client";
import { createAuthClient } from "better-auth/client";

const memberAuthClient = createAuthClient({
  basePath: "/api/auth",
  fetchOptions: {
    credentials: "same-origin",
    redirect: "manual",
  },
  plugins: [apiKeyClient()],
});

export { memberAuthClient };
