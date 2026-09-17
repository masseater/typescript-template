export type ServiceName = "user" | "admin" | "wiki";
export type Correlation = { traceId: string; spanId: string; requestId: string };

export const randomHex = (bytes: number): string =>
  Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
export const validTraceId = (value: unknown): value is string =>
  typeof value === "string" && /^[0-9a-f]{32}$/.test(value) && !/^0+$/.test(value);
export const validSpanId = (value: unknown): value is string =>
  typeof value === "string" && /^[0-9a-f]{16}$/.test(value) && !/^0+$/.test(value);
export const validRequestId = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);

export function parentContext(value: string | null) {
  const match = value?.match(/^00-([0-9a-f]{32})-([0-9a-f]{16})-0[01]$/);
  if (!match || !validTraceId(match[1]) || !validSpanId(match[2])) return undefined;
  return { traceId: match[1], parentSpanId: match[2] };
}

const httpMethods = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"] as const;

export const httpMethod = (method: string): (typeof httpMethods)[number] | "_OTHER" =>
  httpMethods.find((candidate) => candidate === method) ?? "_OTHER";

export function routeLabel(pathname: string, routes: Readonly<Record<string, string>>): string {
  if (Object.hasOwn(routes, pathname)) return routes[pathname] ?? "unmatched";
  const prefixes = Object.entries(routes)
    .filter(([path]) => path.endsWith("/*"))
    .sort(([left], [right]) => right.length - left.length);
  return prefixes.find(([path]) => pathname.startsWith(path.slice(0, -1)))?.[1] ?? "unmatched";
}

export function validateRoutes(routes: Readonly<Record<string, string>>) {
  for (const [path, label] of Object.entries(routes)) {
    if (
      !path.startsWith("/") ||
      path.includes("?") ||
      path.includes("#") ||
      (path.includes("*") && (!path.endsWith("/*") || path.slice(0, -1).includes("*"))) ||
      !/^[a-z][a-z0-9_.-]{0,63}$/.test(label)
    ) {
      throw new Error("Telemetry routes require fixed paths and bounded labels");
    }
  }
}
