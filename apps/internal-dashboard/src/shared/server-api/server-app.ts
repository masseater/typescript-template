import { handleAuthRequest } from "@repo/auth";
import { APPLICATION } from "@repo/config";
import { sessionApi, unavailable } from "@repo/runtime/account";
import { apiDocs, apiRoot, apiRoutes, createApi } from "@repo/runtime/http";

import { dashboardApi } from "./dashboard-api.ts";
import { flagsApi } from "./flags-api.ts";
import { inquiryApi } from "./inquiry-api.ts";
import { serveMcp } from "./mcp.ts";
import { recordingsApi } from "./recordings-api.ts";
import { reporting, runtime } from "./runtime.ts";
import { staffApi } from "./staff-api.ts";
import { wikiEditApi } from "./wiki-edit-api.ts";

const api = apiRoutes(runtime, reporting);

const wikiApi = createApi("")
  .use(
    createApi(apiRoot)
      .use(apiDocs(APPLICATION.internalDashboard))
      .use(sessionApi(api))
      .use(staffApi(api))
      .use(flagsApi(api))
      .use(inquiryApi(api))
      .use(dashboardApi(api))
      .use(recordingsApi(api))
      .use(wikiEditApi(api)),
  )
  .all("/mcp", ...api.raw(serveMcp, unavailable))
  .all("/.well-known/oauth-*", ...api.raw(handleAuthRequest, unavailable));

export { wikiApi, wikiApi as app };
export default wikiApi;
