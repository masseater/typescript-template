import { apiRoutes, compileApi } from "@template/runtime/http";
import { adminRoutes } from "./admin-api.ts";
import { runtime } from "./runtime.ts";

const adminApi = compileApi(adminRoutes(apiRoutes(runtime)));

export { adminApi };
