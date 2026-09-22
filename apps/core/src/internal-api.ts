import { InternalRpcs } from "@repo/core-api";
import { APPLICATION } from "@repo/config";

import { entrypointClass } from "./entrypoint.ts";
import { internalHandlers } from "./handlers.ts";

class InternalApi extends entrypointClass(InternalRpcs, APPLICATION.wiki, internalHandlers) {}

export { InternalApi };
