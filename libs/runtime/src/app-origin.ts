import { Context } from "effect";

class AppOrigin extends Context.Service<AppOrigin, string>()("@template/runtime/AppOrigin") {}

export { AppOrigin };
