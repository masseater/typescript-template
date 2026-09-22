import * as Effect from "effect/Effect";
import * as HttpHeaders from "effect/unstable/http/Headers";
import { RpcClient } from "effect/unstable/rpc";

const cookieHeaderName = "cookie";

const cookieHeadersFrom = (headers: Headers): HttpHeaders.Headers => {
  const cookie = headers.get(cookieHeaderName) ?? undefined;
  return cookie === undefined || cookie.length === 0
    ? HttpHeaders.empty
    : HttpHeaders.fromInput({ [cookieHeaderName]: cookie });
};

const withForwardedCookies = (
  headers: Headers,
): (<A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.Effect<A, E, R>) =>
  RpcClient.withHeaders(cookieHeadersFrom(headers));

export { cookieHeadersFrom, withForwardedCookies };
