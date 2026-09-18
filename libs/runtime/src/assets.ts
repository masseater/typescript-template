import type { AssetFetcher } from "@repo/config";
import { Context } from "effect";

class Assets extends Context.Service<Assets, AssetFetcher>()("@repo/runtime/Assets") {}

export { Assets };
