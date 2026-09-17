import { apiResponse, readJson } from "./http.ts";
import { maxLength, minLength, parse, pipe, strictObject, string } from "valibot";
import type { AppRequestContext } from "./index.ts";
import { checkDatabase } from "@template/db";

interface RouteInput {
  readonly request: Request;
  readonly context: AppRequestContext;
}

const maximumTokenLength = 4096;
const tooManyRequests = 429;
const badRequest = 400;
const verifyEmailInput = strictObject({
  token: pipe(string(), minLength(1), maxLength(maximumTokenLength)),
});

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
async function healthHandler({ context }: RouteInput): Promise<Response> {
  return apiResponse(async () => {
    await checkDatabase(context.runtime.database);
    return {
      ok: true,
      release: context.runtime.config.APP_RELEASE,
      service: context.runtime.audience,
    };
  }, context.runtime.reportError);
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
async function authHandler({ request, context }: RouteInput): Promise<Response> {
  return context.runtime.auth.handler(request);
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
async function sessionHandler({ request, context }: RouteInput): Promise<Response> {
  return apiResponse(async () => {
    const { user, strong } = await context.runtime.session(request, true);
    return {
      strong,
      user: {
        email: user.email,
        id: user.id,
        name: user.name,
        role: user.role,
        twoFactorEnabled: user.twoFactorEnabled,
      },
    };
  }, context.runtime.reportError);
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
async function verifyEmailHandler({ request, context }: RouteInput): Promise<Response> {
  return apiResponse(async () => {
    const origin = context.runtime.config.APP_ORIGIN;
    const { token } = parse(verifyEmailInput, await readJson(request, origin));
    const verification = new URL("/api/auth/verify-email", origin);
    verification.searchParams.set("token", token);
    const response = await context.runtime.auth.handler(
      new Request(verification, { headers: request.headers, method: "GET" }),
    );
    await response.body?.cancel();
    if (!response.ok) {
      throw Object.assign(new Error("EMAIL_VERIFICATION_FAILED"), {
        statusCode: response.status === tooManyRequests ? tooManyRequests : badRequest,
      });
    }
    return { verified: true };
  }, context.runtime.reportError);
}

export { authHandler, healthHandler, sessionHandler, verifyEmailHandler };
