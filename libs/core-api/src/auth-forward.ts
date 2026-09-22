const authApiPathPrefix = "/api/auth";
const oauthWellKnownPathPrefix = "/.well-known/oauth-";

const isAuthForwardPath = (pathname: string): boolean =>
  pathname === authApiPathPrefix ||
  pathname.startsWith(`${authApiPathPrefix}/`) ||
  pathname.startsWith(oauthWellKnownPathPrefix);

const forwardAuthRequest = (core: Fetcher, request: Request): Promise<Response> =>
  core.fetch(request);

export { authApiPathPrefix, forwardAuthRequest, isAuthForwardPath, oauthWellKnownPathPrefix };
