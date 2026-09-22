import { APPLICATION } from "@repo/config";
import { AdminRpcs } from "@repo/core-api";

import { entrypointClass } from "./entrypoint.ts";
import { adminHandlers } from "./handlers.ts";

class AdminApi extends entrypointClass(AdminRpcs, APPLICATION.admin, adminHandlers) {}

export { AdminApi };
