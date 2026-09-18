import { Schema } from "effect";

export type Correlation = {
  readonly traceId: string;
  readonly spanId: string;
  readonly requestId: string;
};

export const traceIdBytes = 16;
export const spanIdBytes = 8;
export const hexRadix = 16;
const hexByteWidth = 2;
export const routeMessage = "Telemetry routes require fixed paths and bounded labels";
const routePathPattern = /^\/[^?#*]*$|^\/(?:[^?#*]*\/)?\*$/u;
export const unmatchedRoute = "unmatched";

export const httpMethods = [
  "_OTHER",
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "OPTIONS",
  "HEAD",
] as const;
export type HttpMethod = (typeof httpMethods)[number];
const [otherHttpMethod] = httpMethods;

export const TraceId = Schema.String.check(Schema.isPattern(/^(?!0+$)[0-9a-f]{32}$/u));
export const SpanId = Schema.String.check(Schema.isPattern(/^(?!0+$)[0-9a-f]{16}$/u));
export const RequestId = Schema.String.check(
  Schema.isPattern(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u),
);
const RouteLabel = Schema.String.check(Schema.isPattern(/^[a-z][a-z0-9_.-]{0,63}$/u));
const Routes = Schema.Record(Schema.String, RouteLabel).check(
  Schema.makeFilter((routes: Readonly<Record<string, string>>) =>
    Object.keys(routes).every((routePath) => routePathPattern.test(routePath)),
  ),
);
const isTraceId = Schema.is(TraceId);
const isSpanId = Schema.is(SpanId);
export const isRequestId = Schema.is(RequestId);
const isHttpMethod = Schema.is(Schema.Literals(httpMethods));
export const isRoutes = Schema.is(Routes);

export const randomHex = (bytes: number): string => {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (byte) =>
    byte.toString(hexRadix).padStart(hexByteWidth, "0"),
  ).join("");
};

export const parentContext = (
  traceparent: string | null,
): { readonly parentSpanId: string; readonly traceId: string } | undefined => {
  const traceparentParts = traceparent?.match(/^00-([0-9a-f]{32})-([0-9a-f]{16})-0[01]$/u);
  const traceId = traceparentParts?.[1];
  const parentSpanId = traceparentParts?.[2];
  return isTraceId(traceId) && isSpanId(parentSpanId) ? { parentSpanId, traceId } : undefined;
};

export const httpMethod = (method: string): HttpMethod => {
  return isHttpMethod(method) ? method : otherHttpMethod;
};

export const routeLabel = (pathname: string, routes: Readonly<Record<string, string>>): string => {
  if (Object.hasOwn(routes, pathname)) {
    return routes[pathname] ?? unmatchedRoute;
  }
  const prefixes = Object.entries(routes)
    .filter(([routePath]) => routePath.endsWith("/*"))
    .toSorted(([left], [right]) => right.length - left.length);
  return (
    prefixes.find(([routePath]) => pathname.startsWith(routePath.slice(0, -1)))?.[1] ??
    unmatchedRoute
  );
};
