import { Context } from "effect";
class AppOrigin extends Context.Service<AppOrigin, string>()("@repo/runtime/AppOrigin") {}
export { AppOrigin };
