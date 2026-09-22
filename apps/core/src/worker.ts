import { AdminRpcs, InternalRpcs, MemberRpcs } from "@repo/core-api";

import { entrypointClass } from "./entrypoint.ts";
import { adminHandlers, internalHandlers, memberHandlers } from "./handlers.ts";

class MemberApi extends entrypointClass(MemberRpcs, memberHandlers) {}
class AdminApi extends entrypointClass(AdminRpcs, adminHandlers) {}
class InternalApi extends entrypointClass(InternalRpcs, internalHandlers) {}

export { AdminApi, InternalApi, MemberApi };

const defaultFetch = (): Response => new Response(null, { status: 404 });

export default { fetch: defaultFetch };
