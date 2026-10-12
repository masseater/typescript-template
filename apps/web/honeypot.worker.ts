import type { HoneypotEnv } from "./edge-guard.ts";

const header = (request: Request, name: string): string => request.headers.get(name) ?? "";

const toDataPoint = (request: Request): AnalyticsEngineDataPoint => {
  const url = new URL(request.url);
  const { country = "", asn = "", asOrganization = "" } = request.cf ?? {};
  return {
    indexes: [url.pathname],
    blobs: [
      url.host,
      url.pathname,
      url.search,
      request.method,
      header(request, "cf-connecting-ip"),
      String(country),
      String(asn),
      String(asOrganization),
      header(request, "user-agent"),
    ],
  };
};

const worker = {
  fetch: (request: Request, env: Readonly<HoneypotEnv>): Response => {
    env.HONEYPOT.writeDataPoint(toDataPoint(request));
    return new Response("", { status: 404 });
  },
};

export default worker;
