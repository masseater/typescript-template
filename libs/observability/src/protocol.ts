import * as v from "valibot";

export type Correlation = { traceId: string; spanId: string; requestId: string };

export const httpMethods = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "OPTIONS",
  "HEAD",
  "_OTHER",
] as const;
export const traceIdSchema = v.pipe(v.string(), v.regex(/^(?!0+$)[0-9a-f]{32}$/));
export const spanIdSchema = v.pipe(v.string(), v.regex(/^(?!0+$)[0-9a-f]{16}$/));
export const requestIdSchema = v.pipe(
  v.string(),
  v.regex(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/),
);
const routesSchema = v.record(
  v.pipe(
    v.string(),
    v.regex(
      /^\/[^?#*]*$|^\/(?:[^?#*]*\/)?\*$/,
      "Telemetry routes require fixed paths and bounded labels",
    ),
  ),
  v.pipe(
    v.string(),
    v.regex(/^[a-z][a-z0-9_.-]{0,63}$/, "Telemetry routes require fixed paths and bounded labels"),
  ),
);

export const randomHex = (bytes: number): string =>
  Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");

export function parentContext(value: string | null) {
  const [, traceId, parentSpanId] = value?.match(/^00-([0-9a-f]{32})-([0-9a-f]{16})-0[01]$/) ?? [];
  return v.is(traceIdSchema, traceId) && v.is(spanIdSchema, parentSpanId)
    ? { traceId, parentSpanId }
    : undefined;
}

export const httpMethod = (method: string) =>
  v.is(v.picklist(httpMethods), method) ? method : "_OTHER";

export function routeLabel(pathname: string, routes: Readonly<Record<string, string>>): string {
  if (Object.hasOwn(routes, pathname)) return routes[pathname] ?? "unmatched";
  const prefixes = Object.entries(routes)
    .filter(([path]) => path.endsWith("/*"))
    .sort(([left], [right]) => right.length - left.length);
  return prefixes.find(([path]) => pathname.startsWith(path.slice(0, -1)))?.[1] ?? "unmatched";
}

export function validateRoutes(routes: Readonly<Record<string, string>>) {
  v.parse(routesSchema, routes);
}
