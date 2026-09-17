import { Schema } from "effect";

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
export const TraceId = Schema.String.check(Schema.isPattern(/^(?!0+$)[0-9a-f]{32}$/));
export const SpanId = Schema.String.check(Schema.isPattern(/^(?!0+$)[0-9a-f]{16}$/));
export const RequestId = Schema.String.check(
  Schema.isPattern(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/),
);
const boundedRoutes = "Telemetry routes require fixed paths and bounded labels";
const routePath = /^\/[^?#*]*$|^\/(?:[^?#*]*\/)?\*$/;
const Routes = Schema.Record(
  Schema.String,
  Schema.String.check(Schema.isPattern(/^[a-z][a-z0-9_.-]{0,63}$/, { message: boundedRoutes })),
).check(
  Schema.makeFilter(
    (routes: Readonly<Record<string, string>>) =>
      Object.keys(routes).every((path) => routePath.test(path)) || boundedRoutes,
  ),
);

export const randomHex = (bytes: number): string =>
  Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");

export function parentContext(value: string | null) {
  const [, traceId, parentSpanId] = value?.match(/^00-([0-9a-f]{32})-([0-9a-f]{16})-0[01]$/) ?? [];
  return Schema.is(TraceId)(traceId) && Schema.is(SpanId)(parentSpanId)
    ? { traceId, parentSpanId }
    : undefined;
}

export const httpMethod = (method: string) =>
  httpMethods.find((candidate) => candidate === method) ?? "_OTHER";

export function routeLabel(pathname: string, routes: Readonly<Record<string, string>>): string {
  if (Object.hasOwn(routes, pathname)) return routes[pathname] ?? "unmatched";
  const prefixes = Object.entries(routes)
    .filter(([path]) => path.endsWith("/*"))
    .sort(([left], [right]) => right.length - left.length);
  return prefixes.find(([path]) => pathname.startsWith(path.slice(0, -1)))?.[1] ?? "unmatched";
}

export function validateRoutes(routes: Readonly<Record<string, string>>) {
  Schema.decodeUnknownSync(Routes)(routes);
}
