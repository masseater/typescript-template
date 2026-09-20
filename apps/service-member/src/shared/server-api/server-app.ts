import { apiRoutes } from "@repo/runtime/http";

import { memberRoutes } from "./member-api.ts";
import { reporting, runtime } from "./runtime.ts";

const userApi = memberRoutes(apiRoutes(runtime, reporting));

export { userApi };
