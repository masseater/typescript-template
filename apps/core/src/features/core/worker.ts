export { MemberApi } from "./member-api.ts";
export { AdminApi } from "./admin-api.ts";
export { InternalApi } from "./internal-api.ts";

const defaultFetch = (): Response => new Response(null, { status: 404 });

export default { fetch: defaultFetch };
