import { APPLICATION } from "@repo/config";
import { sessionApi } from "@repo/runtime/account";
import { apiDocs, apiRoot, createApi } from "@repo/runtime/http";

import { flagsApi } from "./flags-api.ts";

import type { WikiServices } from "#shared/wiki/index.ts";
import type { ApiRoutes } from "@repo/runtime/http";

function wikiRoutes(routes: ApiRoutes<WikiServices>) {
<<<<<<< HEAD
  return createApi(apiRoot)
    .use(apiDocs("internal-dashboard"))
    .use(sessionApi(routes))
    .use(flagsApi(routes));
=======
  return createApi(apiRoot).use(apiDocs(APPLICATION.wiki)).use(sessionApi(routes));
>>>>>>> 40e24dad (fix: bind Scalar apiDocs audiences to APPLICATION vocabulary)
}

export { wikiRoutes };
