import { httpStatus } from "@repo/observability";

const privateHeaders = {
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
} as const;

function jsonResponse(value: unknown, status: number = httpStatus.ok): Response {
  return Response.json(value, { headers: privateHeaders, status });
}

function secureResponse(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("cache-control", "no-store");
  headers.set("x-content-type-options", "nosniff");
  headers.set("referrer-policy", "no-referrer");
  headers.set("x-frame-options", "DENY");
  headers.set("permissions-policy", "camera=(), microphone=(), geolocation=()");
  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}

export { jsonResponse, secureResponse };
