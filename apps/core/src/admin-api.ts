import { AdminRpcs } from "@repo/core-api";

import { entrypointClass } from "./entrypoint.ts";
import { adminHandlers } from "./handlers.ts";

class AdminApi extends entrypointClass(AdminRpcs, adminHandlers) {}

export { AdminApi };
