import { accountApi } from "@repo/runtime/account";
import { apiRoot, apiRoutes, createApi } from "@repo/runtime/http";

import { adminRoutes } from "./admin-api.ts";
import { reporting, runtime } from "./runtime.ts";

const api = apiRoutes(runtime, reporting);

const adminApi = createApi(apiRoot).use(accountApi(api)).use(adminRoutes(api));

export { adminApi };
