import { apiDocs, apiRoot, createApi } from "@template/runtime/http";
import type { ApiRoutes } from "@template/runtime/http";
import type { WikiServices } from "@template/runtime/wiki";
import { sessionApi } from "@template/runtime/account";

function wikiRoutes(api: ApiRoutes<WikiServices>) {
  return createApi(apiRoot).use(apiDocs("wiki")).use(sessionApi(api));
}

export { wikiRoutes };
