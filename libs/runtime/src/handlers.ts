import * as v from "valibot";
import type { AppRequestContext } from "./index.ts";
import { apiResponse, readJson } from "./http.ts";

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

export function verifyEmailHandler({ request, context }: RouteInput): Promise<Response> {
  return apiResponse(async () => {
    const { token } = v.parse(
      v.strictObject({ token: v.pipe(v.string(), v.minLength(1), v.maxLength(4096)) }),
      await readJson(request, context.runtime.config.APP_ORIGIN),
    );
    const verification = new URL("/api/auth/verify-email", context.runtime.config.APP_ORIGIN);
    verification.searchParams.set("token", token);
    const response = await context.runtime.auth.handler(
      new Request(verification, { method: "GET", headers: request.headers }),
    );
    await response.body?.cancel();
    if (!response.ok)
      throw Object.assign(new Error("EMAIL_VERIFICATION_FAILED"), {
        statusCode: response.status === 429 ? 429 : 400,
      });
    return { verified: true };
  }, context.runtime.reportError);
}
