import { createAppWorker } from "@template/runtime/app";
import { runtime } from "./runtime.ts";
import { wikiApi } from "./api.ts";
import { wikiRoute } from "./routing.ts";

// oxlint-disable-next-line import/no-default-export
export default createAppWorker({ api: wikiApi, route: wikiRoute, runtime });
