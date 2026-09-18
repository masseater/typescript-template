import { apiRoutes, compileApi } from "@template/runtime/http";
import { runtime } from "./runtime.ts";
import { userRoutes } from "./user-api.ts";

const userApi = compileApi(userRoutes(apiRoutes(runtime)));

export { userApi };
