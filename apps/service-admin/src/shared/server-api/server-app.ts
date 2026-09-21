import { verifySession } from "@repo/auth";
import { APPLICATION } from "@repo/config";
import { accountApi, sessionFailures } from "@repo/runtime/account";
import { apiDocs, apiRoot, apiRoutes, createApi } from "@repo/runtime/http";

import { adminRoutes } from "./admin-api.ts";
import { agreementApi } from "./agreement-api.ts";
import { reporting, runtime } from "./runtime.ts";

const api = apiRoutes(runtime, reporting);

const adminApi = createApi(apiRoot)
  .use(
    apiDocs(
      APPLICATION.admin,
      api.guard((request) => verifySession(request.headers), sessionFailures),
    ),
  )
  .use(accountApi(api))
  .use(agreementApi(api))
  .use(adminRoutes(api));

export { adminApi };
