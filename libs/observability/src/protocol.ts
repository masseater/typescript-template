type ServiceName = "user" | "admin" | "wiki";
type RouteEntry = readonly [string, string];
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

function randomHex(bytes: number): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (byte) =>
    byte.toString(hexRadix).padStart(hexByteWidth, "0"),
  ).join("");
}

function validTraceId(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{32}$/u.test(value) && !/^0+$/u.test(value);
}

function validSpanId(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{16}$/u.test(value) && !/^0+$/u.test(value);
}

function validRequestId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(value)
  );
}

function parentContext(value: string | null): ParentContext | undefined {
  const groups = value?.match(
    /^00-(?<traceId>[0-9a-f]{32})-(?<parentSpanId>[0-9a-f]{16})-0[01]$/u,
  )?.groups;
  const traceId = groups?.["traceId"];
  const parentSpanId = groups?.["parentSpanId"];
  return validTraceId(traceId) && validSpanId(parentSpanId) ? { parentSpanId, traceId } : undefined;
}

function httpMethod(method: string): string {
  return ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"].includes(method)
    ? method
    : "_OTHER";
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

function validRoute(path: string, label: string): boolean {
  const wildcard = path.includes("*");
  return (
    path.startsWith("/") &&
    !path.includes("?") &&
    !path.includes("#") &&
    (!wildcard || (path.endsWith("/*") && !path.slice(0, -1).includes("*"))) &&
    /^[a-z][a-z0-9_.-]{0,63}$/u.test(label)
  );
}

function validateRoutes(routes: Readonly<Record<string, string>>): void {
  if (Object.entries(routes).some(([path, label]: RouteEntry) => !validRoute(path, label))) {
    throw new Error("Telemetry routes require fixed paths and bounded labels");
  }
}

export {
  httpMethod,
  parentContext,
  randomHex,
  routeLabel,
  spanIdBytes,
  traceIdBytes,
  validRequestId,
  validSpanId,
  validTraceId,
  validateRoutes,
};
export type { Correlation, ServiceName };
