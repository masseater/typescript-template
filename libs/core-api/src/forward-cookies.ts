import { memberApiKeyHeader } from "@repo/config";
import type * as Effect from "effect/Effect";
import * as HttpHeaders from "effect/unstable/http/Headers";
import { RpcClient } from "effect/unstable/rpc";

const cookieHeaderName = "cookie";
const authorizationHeaderName = "authorization";

const cookieHeadersFrom = (headers: Headers): HttpHeaders.Headers => {
  const forwarded: Record<string, string> = {};
  const cookie = headers.get(cookieHeaderName);
  if (cookie !== null && cookie.length > 0) {
    forwarded[cookieHeaderName] = cookie;
  }
  const apiKey = headers.get(memberApiKeyHeader);
  if (apiKey !== null && apiKey.length > 0) {
    forwarded[memberApiKeyHeader] = apiKey;
  }
  const authorization = headers.get(authorizationHeaderName);
  if (authorization !== null && authorization.length > 0) {
    forwarded[authorizationHeaderName] = authorization;
  }
  return Object.keys(forwarded).length === 0 ? HttpHeaders.empty : HttpHeaders.fromInput(forwarded);
};

const withForwardedCookies = (
  headers: Headers,
): (<A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.Effect<A, E, R>) =>
  RpcClient.withHeaders(cookieHeadersFrom(headers));

export { cookieHeadersFrom, withForwardedCookies };
