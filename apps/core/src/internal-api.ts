import { APPLICATION } from "@repo/config";
import { InternalRpcs } from "@repo/core-api";

import { entrypointClass } from "./entrypoint.ts";
import { internalHandlers } from "./handlers.ts";

class InternalApi extends entrypointClass(InternalRpcs, APPLICATION.wiki, internalHandlers) {}

export { InternalApi };
