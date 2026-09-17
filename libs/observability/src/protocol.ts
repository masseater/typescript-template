import { Schema } from "effect";

type RouteEntry = readonly [string, string];
type HttpMethod = (typeof httpMethods)[number];
interface Correlation {
  readonly traceId: string;
  readonly spanId: string;
  readonly requestId: string;
}
interface ParentContext {
  readonly parentSpanId: string;
  readonly traceId: string;
}

const traceIdBytes = 16;
const spanIdBytes = 8;
const hexRadix = 16;
const hexByteWidth = 2;
const routeMessage = "Telemetry routes require fixed paths and bounded labels";
const routePathPattern = /^\/[^?#*]*$|^\/(?:[^?#*]*\/)?\*$/u;

const httpMethods = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD", "_OTHER"] as const;
const HttpMethodSchema = Schema.Literals(httpMethods);
const TraceId = Schema.String.check(Schema.isPattern(/^(?!0+$)[0-9a-f]{32}$/u));
const SpanId = Schema.String.check(Schema.isPattern(/^(?!0+$)[0-9a-f]{16}$/u));
const RequestId = Schema.String.check(
  Schema.isPattern(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u),
);
const RouteLabel = Schema.String.check(Schema.isPattern(/^[a-z][a-z0-9_.-]{0,63}$/u));
const routePathsValid = Schema.makeFilter((routes: Readonly<Record<string, string>>) =>
  Object.keys(routes).every((path) => routePathPattern.test(path)),
);
const Routes = Schema.Record(Schema.String, RouteLabel).check(routePathsValid);
const isTraceId = Schema.is(TraceId);
const isSpanId = Schema.is(SpanId);
const isRequestId = Schema.is(RequestId);
const isHttpMethod = Schema.is(HttpMethodSchema);
const isRoutes = Schema.is(Routes);

function randomHex(bytes: number): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (byte) =>
    byte.toString(hexRadix).padStart(hexByteWidth, "0"),
  ).join("");
}

function parentContext(value: string | null): ParentContext | undefined {
  const groups = value?.match(
    /^00-(?<traceId>[0-9a-f]{32})-(?<parentSpanId>[0-9a-f]{16})-0[01]$/u,
  )?.groups;
  const traceId = groups?.["traceId"];
  const parentSpanId = groups?.["parentSpanId"];
  return isTraceId(traceId) && isSpanId(parentSpanId) ? { parentSpanId, traceId } : undefined;
}

function httpMethod(method: string): HttpMethod {
  return isHttpMethod(method) ? method : "_OTHER";
}

function routeLabel(pathname: string, routes: Readonly<Record<string, string>>): string {
  if (Object.hasOwn(routes, pathname)) {
    return routes[pathname] ?? "unmatched";
  }
  const prefixes = Object.entries(routes)
    .filter(([path]: RouteEntry) => path.endsWith("/*"))
    .toSorted(([left]: RouteEntry, [right]: RouteEntry) => right.length - left.length);
  return (
    prefixes.find(([path]: RouteEntry) => pathname.startsWith(path.slice(0, -1)))?.[1] ??
    "unmatched"
  );
}

export {
  RequestId,
  SpanId,
  TraceId,
  httpMethod,
  httpMethods,
  isRequestId,
  isRoutes,
  parentContext,
  randomHex,
  routeLabel,
  routeMessage,
  spanIdBytes,
  traceIdBytes,
};
export type { Correlation, HttpMethod };
