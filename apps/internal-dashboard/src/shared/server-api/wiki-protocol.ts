import { handleAuthRequest } from "@repo/auth";
import { unavailable } from "@repo/runtime/account";
import { apiRoutes, createApi } from "@repo/runtime/http";

import { serveMcp } from "./mcp.ts";
import { reporting, runtime } from "./runtime.ts";

const api = apiRoutes(runtime, reporting);

const wikiProtocol = createApi("")
  .all("/mcp", api.raw(serveMcp, unavailable))
  .all("/.well-known/oauth-*", api.raw(handleAuthRequest, unavailable));

export { wikiProtocol };
