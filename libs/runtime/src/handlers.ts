import type { AppRequestContext } from "./index.ts";
import { apiResponse } from "./http.ts";

type RouteInput = { request: Request; context: AppRequestContext };

export function authHandler({ request, context }: RouteInput): Promise<Response> {
  return context.runtime.auth.handler(request);
}

export function sessionHandler({ request, context }: RouteInput): Promise<Response> {
  return apiResponse(async () => {
    const { user, strong } = await context.runtime.session(request, true);
    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        twoFactorEnabled: user.twoFactorEnabled,
      },
      strong,
    };
  }, context.runtime.reportError);
}
