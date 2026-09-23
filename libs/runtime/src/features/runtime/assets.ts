import { Context } from "effect";

import type { AssetFetcher } from "@repo/config";
class Assets extends Context.Service<Assets, AssetFetcher>()("@repo/runtime/Assets") {}
export { Assets };
