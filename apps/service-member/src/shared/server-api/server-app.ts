import { apiRoutes } from "@repo/runtime/http";

import { memberApi } from "./member-api.ts";
import { reporting, runtime } from "./runtime.ts";

const userApi = memberApi(apiRoutes(runtime, reporting));

export { userApi };
