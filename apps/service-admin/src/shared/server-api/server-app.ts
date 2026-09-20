import { apiRoutes } from "@repo/runtime/http";

import { adminRoutes } from "./admin-api.ts";
import { reporting, runtime } from "./runtime.ts";

const adminApi = adminRoutes(apiRoutes(runtime, reporting));

export { adminApi };
