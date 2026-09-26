import { Context } from "effect";

import type { AssetFetcher } from "@repo/config";
class Assets extends Context.Service<Assets, AssetFetcher>()(
  "@repo/runtime/features/runtime/assets",
) {}
export { Assets };
