import { InternalRpcs } from "@repo/core-api";

import { entrypointClass } from "./entrypoint.ts";
import { internalHandlers } from "./handlers.ts";

class InternalApi extends entrypointClass(InternalRpcs, internalHandlers) {}

export { InternalApi };
