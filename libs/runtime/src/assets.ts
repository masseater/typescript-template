import { Context } from "effect";

import type { AssetFetcher } from "@template/config";

class Assets extends Context.Service<Assets, AssetFetcher>()("@template/runtime/Assets") {}

export { Assets };
