import type { AssetFetcher } from "@template/config";
import { Context } from "effect";

class Assets extends Context.Service<Assets, AssetFetcher>()("@template/runtime/Assets") {}

export { Assets };
