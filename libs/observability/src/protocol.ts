import { is, parse, picklist, pipe, record, regex, string } from "valibot";

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

const httpMethods = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD", "_OTHER"] as const;
const httpMethodSchema = picklist(httpMethods);
const traceIdSchema = pipe(string(), regex(/^(?!0+$)[0-9a-f]{32}$/u));
const spanIdSchema = pipe(string(), regex(/^(?!0+$)[0-9a-f]{16}$/u));
const requestIdSchema = pipe(
  string(),
  regex(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u),
);
const routePathSchema = pipe(string(), regex(/^\/[^?#*]*$|^\/(?:[^?#*]*\/)?\*$/u, routeMessage));
const routeLabelSchema = pipe(string(), regex(/^[a-z][a-z0-9_.-]{0,63}$/u, routeMessage));
const routesSchema = record(routePathSchema, routeLabelSchema);

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
  return is(traceIdSchema, traceId) && is(spanIdSchema, parentSpanId)
    ? { parentSpanId, traceId }
    : undefined;
}

function httpMethod(method: string): HttpMethod {
  return is(httpMethodSchema, method) ? method : "_OTHER";
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

function validateRoutes(routes: Readonly<Record<string, string>>): void {
  parse(routesSchema, routes);
}

export {
  httpMethod,
  httpMethods,
  parentContext,
  randomHex,
  requestIdSchema,
  routeLabel,
  spanIdBytes,
  spanIdSchema,
  traceIdBytes,
  traceIdSchema,
  validateRoutes,
};
export type { Correlation, HttpMethod };
