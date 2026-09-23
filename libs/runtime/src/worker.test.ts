import { httpStatus } from "@repo/config";
import { Telemetry } from "@repo/observability";
import { cspNonceHeader, strictTransportSecurity } from "@repo/runtime/security";
import { Effect, Layer, Schema } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { AppOrigin, apiRoutes, createApi, elysiaServer } from "./http.ts";
import { startRoute, workerRuntime } from "./worker.ts";

const origin = "http://localhost:3001";
const secureOrigin = "https://user.example.test";
const telemetry = Telemetry.layer({ release: "test", routes: {}, serviceName: "service-member" });
const appContext = Layer.succeed(AppOrigin, origin).pipe(Layer.provideMerge(telemetry));
const api = apiRoutes(
  workerRuntime(() => appContext),
  { service: "service-member" },
);

describe("an api response behind a start server route", () => {
  const it = test.extend("encodedView", () =>
    Effect.runPromise(
      Effect.gen(function* encodedViewProgram() {
        const viewRoute = api.route(
          Schema.Struct({ id: Schema.String }),
          () => Effect.succeed({ id: "visible", profile: "x" }),
          {},
        );
        const {
          handlers: { ANY: answerAny },
        } = elysiaServer(createApi("").get("/api/view", viewRoute));
        const answered = yield* startRoute({
          fetch: (rendered) => answerAny({ request: rendered }),
        })(new Request(`${origin}/api/view`));
        const view: unknown = yield* Effect.promise(() => answered.json());
        return {
          headers: [
            answered.headers.get("x-frame-options"),
            answered.headers.get("cache-control"),
            answered.headers.get("referrer-policy"),
            answered.headers.get("x-content-type-options"),
          ],
          status: answered.status,
          view,
        };
      }),
    ));

  it("encodes the response contract and drops fields outside it", ({ encodedView }) => {
    expect(encodedView).toStrictEqual({
      headers: ["DENY", "no-store", "no-referrer", "nosniff"],
      status: httpStatus.ok,
      view: { id: "visible" },
    });
  });
});

describe("an api route behind a start server route that fails unexpectedly", () => {
  const it = test.extend("brokenStatus", () =>
    Effect.runPromise(
      Effect.gen(function* brokenStatusProgram() {
        const viewRoute = api.route(
          Schema.Struct({}),
          () => Effect.fail({ _tag: "Broken" } as const),
          {
            Broken: "unexpected",
          },
        );
        const {
          handlers: { ANY: answerAny },
        } = elysiaServer(createApi("").get("/api/broken", viewRoute));
        const answered = yield* startRoute({
          fetch: (rendered) => answerAny({ request: rendered }),
        })(new Request(`${origin}/api/broken`));
        return answered.status;
      }),
    ));

  it("answers with a generic 500 response", ({ brokenStatus }) => {
    expect(brokenStatus).toBe(httpStatus.internalServerError);
  });
});

describe("a HEAD request behind a start server route", () => {
  const it = test.extend("headStatus", () =>
    Effect.runPromise(
      Effect.gen(function* headStatusProgram() {
        const viewRoute = api.route(
          Schema.Struct({ id: Schema.String }),
          () => Effect.succeed({ id: "visible" }),
          {},
        );
        const {
          handlers: { HEAD: answerHead },
        } = elysiaServer(createApi("").get("/api/view", viewRoute));
        const answered = yield* startRoute({
          fetch: (rendered) => answerHead({ request: rendered }),
        })(new Request(`${origin}/api/view`, { method: "HEAD" }));
        return answered.status;
      }),
    ));

  it("is answered on every route that answers GET", ({ headStatus }) => {
    expect(headStatus).toBe(httpStatus.ok);
  });
});

describe("an unknown api path behind a start server route", () => {
  const it = test.extend("missingAnswer", () =>
    Effect.runPromise(
      Effect.gen(function* missingAnswerProgram() {
        const viewRoute = api.route(Schema.Struct({}), () => Effect.succeed({}), {});
        const {
          handlers: { ANY: answerAny },
        } = elysiaServer(createApi("").get("/api/view", viewRoute));
        const answered = yield* startRoute({
          fetch: (rendered) => answerAny({ request: rendered }),
        })(new Request(`${origin}/api/missing`));
        const missing: unknown = yield* Effect.promise(() => answered.json());
        return {
          json: (answered.headers.get("content-type") ?? "").includes("application/json"),
          missing,
          status: answered.status,
        };
      }),
    ));

  it("is answered with the same json failure shape", ({ missingAnswer }) => {
    expect(missingAnswer).toStrictEqual({
      json: true,
      missing: { error: "見つかりませんでした。" },
      status: httpStatus.notFound,
    });
  });
});

describe("a document behind a start server route", () => {
  const it = test.extend("documentPolicy", () =>
    Effect.runPromise(
      Effect.gen(function* documentPolicyProgram() {
        const served = yield* startRoute({
          fetch: (rendered) =>
            new Response("<!DOCTYPE html>", {
              headers: {
                "content-type": "text/html; charset=utf-8",
                "x-rendered-nonce": rendered.headers.get(cspNonceHeader) ?? "",
              },
            }),
        })(new Request(origin));
        const policy = served.headers.get("content-security-policy") ?? "";
        const handed = /'nonce-(?<nonce>[^']+)'/u.exec(policy)?.groups?.["nonce"] ?? "";
        return {
          directives: policy.replaceAll(handed, "handed").split("; "),
          wellFormedNonce: /^[\w+/]{22}==$/u.test(handed),
        };
      }),
    ));

  it("names the nonce the renderer was handed and nothing weaker", ({ documentPolicy }) => {
    expect(documentPolicy).toStrictEqual({
      directives: [
        "default-src 'none'",
        "script-src 'nonce-handed' 'strict-dynamic'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data:",
        "font-src 'self'",
        "connect-src 'self'",
        "manifest-src 'self'",
        "form-action 'self'",
        "base-uri 'none'",
        "frame-ancestors 'none'",
        "object-src 'none'",
      ],
      wellFormedNonce: true,
    });
  });
});

describe("the nonce a document renderer was handed", () => {
  const it = test.extend("renderedScriptSource", () =>
    Effect.runPromise(
      Effect.gen(function* renderedScriptSourceProgram() {
        const served = yield* startRoute({
          fetch: (rendered) =>
            new Response("<!DOCTYPE html>", {
              headers: {
                "content-type": "text/html; charset=utf-8",
                "x-rendered-nonce": rendered.headers.get(cspNonceHeader) ?? "",
              },
            }),
        })(new Request(origin));
        const renderedNonce = served.headers.get("x-rendered-nonce") ?? "";
        return (served.headers.get("content-security-policy") ?? "")
          .replaceAll(`'nonce-${renderedNonce}'`, "'nonce-rendered'")
          .split("; ")
          .find((directive) => directive.startsWith("script-src"));
      }),
    ));

  it("is the very nonce the policy names", ({ renderedScriptSource }) => {
    expect(renderedScriptSource).toBe("script-src 'nonce-rendered' 'strict-dynamic'");
  });
});

describe("two documents behind a start server route", () => {
  const it = test.extend("nonceRepeated", () =>
    Effect.runPromise(
      Effect.gen(function* nonceRepeatedProgram() {
        const route = startRoute({
          fetch: (rendered) =>
            new Response("<!DOCTYPE html>", {
              headers: {
                "content-type": "text/html; charset=utf-8",
                "x-rendered-nonce": rendered.headers.get(cspNonceHeader) ?? "",
              },
            }),
        });
        const first = yield* route(new Request(origin));
        const second = yield* route(new Request(origin));
        return first.headers.get("x-rendered-nonce") === second.headers.get("x-rendered-nonce");
      }),
    ));

  it("draw a fresh nonce each", ({ nonceRepeated }) => {
    expect(nonceRepeated).toBe(false);
  });
});

describe("a document request carrying a forged nonce", () => {
  const it = test.extend("forgedNonceNamed", () =>
    Effect.runPromise(
      Effect.gen(function* forgedNonceNamedProgram() {
        const forged = "Zm9yZ2VkLW5vbmNlLTAwMA==";
        const served = yield* startRoute({
          fetch: (rendered) =>
            new Response("<!DOCTYPE html>", {
              headers: {
                "content-type": "text/html; charset=utf-8",
                "x-rendered-nonce": rendered.headers.get(cspNonceHeader) ?? "",
              },
            }),
        })(new Request(origin, { headers: { [cspNonceHeader]: forged } }));
        return (served.headers.get("content-security-policy") ?? "").includes(forged);
      }),
    ));

  it("never lets the caller supply the nonce the policy will name", ({ forgedNonceNamed }) => {
    expect(forgedNonceNamed).toBe(false);
  });
});

describe("a document that arrived over https", () => {
  const it = test.extend("documentTransportSecurity", () =>
    Effect.runPromise(
      startRoute({
        fetch: () =>
          new Response("<!DOCTYPE html>", {
            headers: { "content-type": "text/html; charset=utf-8" },
          }),
      })(new Request(secureOrigin)).pipe(
        Effect.map((served) => served.headers.get("strict-transport-security")),
      ),
    ));

  it("demands https for a year", ({ documentTransportSecurity }) => {
    expect(documentTransportSecurity).toBe(strictTransportSecurity);
  });
});
