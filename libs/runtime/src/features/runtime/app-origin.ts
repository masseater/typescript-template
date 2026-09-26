import { Context } from "effect";
class AppOrigin extends Context.Service<AppOrigin, string>()(
  "@repo/runtime/features/runtime/app-origin/AppOrigin",
) {}
export { AppOrigin };
