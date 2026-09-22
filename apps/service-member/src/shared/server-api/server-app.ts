import { unavailable, forwardAuth } from "@repo/runtime/account";
import { apiRoutes, createApi } from "@repo/runtime/http";

import { serveMcp } from "#shared/mcp/index.ts";
import { memberApi } from "./member-api.ts";
import { reporting, runtime } from "./runtime.ts";

const api = apiRoutes(runtime, reporting);

const userApi = memberApi(api);

const memberProtocol = createApi("")
  .all("/mcp", ...api.raw(serveMcp, unavailable))
  .all("/.well-known/oauth-*", ...api.raw(forwardAuth, {}));

export { memberProtocol, userApi, userApi as app };
export default userApi;
