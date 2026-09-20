import { apiRoutes } from "@repo/runtime/http";

import { createUserApi } from "./create-user-api.ts";
import { reporting, runtime } from "./runtime.ts";

const userApi = createUserApi(apiRoutes(runtime, reporting));

export { userApi };
