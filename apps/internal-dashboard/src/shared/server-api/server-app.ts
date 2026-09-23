import { handleAuthRequest } from "@repo/auth";
import { sessionApi, unavailable } from "@repo/runtime/account";
import { apiRoot, apiRoutes, createApi } from "@repo/runtime/http";

import { flagsApi } from "./flags-api.ts";
import { serveMcp } from "./mcp.ts";
import { recordingsApi } from "./recordings-api.ts";
import { reporting, runtime } from "./runtime.ts";

const api = apiRoutes(runtime, reporting);

const wikiApi = createApi("")
  .use(createApi(apiRoot).use(sessionApi(api)).use(flagsApi(api)).use(recordingsApi(api)))
  .all("/mcp", api.raw(serveMcp, unavailable))
  .all("/.well-known/oauth-*", api.raw(handleAuthRequest, unavailable));

export { wikiApi, wikiApi as app };
export default wikiApi;
