import { handleAuthRequest } from "@repo/auth";
import { accountApi, unavailable } from "@repo/runtime/account";
import { apiRoot, apiRoutes, createApi } from "@repo/runtime/http";

import { serveMcp } from "#shared/admin/index.ts";
import { adminRoutes } from "./admin-api.ts";
import { agreementApi } from "./agreement-api.ts";
import { inquiryApi } from "./inquiry-api.ts";
import { reportApi } from "./report-api.ts";
import { reporting, runtime } from "./runtime.ts";

const api = apiRoutes(runtime, reporting);

const adminApi = createApi(apiRoot)
  .use(accountApi(api))
  .use(agreementApi(api))
  .use(inquiryApi(api))
  .use(reportApi(api))
  .use(adminRoutes(api));

const adminProtocol = createApi("")
  .all("/mcp", api.raw(serveMcp, unavailable))
  .all("/.well-known/oauth-*", api.raw(handleAuthRequest, unavailable));

export { adminApi, adminProtocol, adminApi as app };
export default adminApi;
