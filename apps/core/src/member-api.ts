import { APPLICATION } from "@repo/config";
import { MemberRpcs } from "@repo/core-api";

import { entrypointClass } from "./entrypoint.ts";
import { memberHandlers } from "./handlers.ts";

class MemberApi extends entrypointClass(MemberRpcs, APPLICATION.user, memberHandlers) {}

export { MemberApi };
