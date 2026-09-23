import { strictTransportSecurity } from "@repo/runtime/security";
import { Effect } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { secureResponse } from "./responses.ts";

const origin = "http://localhost:3001";
const secureOrigin = "https://user.example.test";
const createdStatus = 201;

describe("a secured private response", () => {
  const it = test.extend("securedAnswer", () =>
    Effect.runPromise(
      Effect.gen(function* securedAnswerProgram() {
        const secured = secureResponse({
          httpRequest: new Request(origin),
          httpResponse: Response.json({ ready: true }, { status: createdStatus }),
        });
        const readiness: unknown = yield* Effect.promise(() => secured.json());
        return {
          headers: [
            secured.headers.get("cache-control"),
            secured.headers.get("referrer-policy"),
            secured.headers.get("x-frame-options"),
          ],
          readiness,
          status: secured.status,
        };
      }),
    ));

  it("keeps status and body while preventing caching and framing", ({ securedAnswer }) => {
    expect(securedAnswer).toStrictEqual({
      headers: ["no-store", "no-referrer", "DENY"],
      readiness: { ready: true },
      status: createdStatus,
    });
  });
});

describe("a secured api response", () => {
  const it = test.extend("apiPolicy", () =>
    secureResponse({
      httpRequest: new Request(origin),
      httpResponse: Response.json({ ready: true }),
    }).headers.get("content-security-policy"));

  it("forbids every resource an api response has no use for", ({ apiPolicy }) => {
    expect(apiPolicy).toBe(
      "default-src 'none'; form-action 'none'; base-uri 'none'; frame-ancestors 'none'; object-src 'none'",
    );
  });
});

describe("a secured response to a request that arrived over https", () => {
  const it = test.extend("transportSecurity", () =>
    secureResponse({
      httpRequest: new Request(secureOrigin),
      httpResponse: Response.json({}),
    }).headers.get("strict-transport-security"));

  it("demands https for a year", ({ transportSecurity }) => {
    expect(transportSecurity).toBe(strictTransportSecurity);
  });
});

describe("a secured response to a request that arrived over http", () => {
  const it = test.extend("transportSecurity", () =>
    secureResponse({
      httpRequest: new Request(origin),
      httpResponse: Response.json({}),
    }).headers.get("strict-transport-security"));

  it("demands nothing of the transport", ({ transportSecurity }) => {
    expect(transportSecurity).toBe(null);
  });
});
