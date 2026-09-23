import { Effect, Exit } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { RequestRejected, readJson } from "./request.ts";

const origin = "http://localhost";
const encoder = new TextEncoder();
const jsonHeaders = new Headers({ "content-type": "application/json", origin });

describe("readJson", () => {
  describe("a body split across chunks", () => {
    const it = test.extend("decoded", () =>
      Effect.runPromiseExit(
        readJson({
          expectedOrigin: origin,
          incoming: {
            body: new ReadableStream<Uint8Array>({
              start(controller): void {
                controller.enqueue(encoder.encode('{"a":'));
                controller.enqueue(encoder.encode("1}"));
                controller.close();
              },
            }),
            headers: jsonHeaders,
          },
        }),
      ));

    it("parses the joined JSON", ({ decoded }) => {
      expect(decoded).toStrictEqual(Exit.succeed({ a: 1 }));
    });
  });

  describe("a chunked body that ends early", () => {
    const it = test.extend("decoded", () =>
      Effect.runPromiseExit(
        readJson({
          expectedOrigin: origin,
          incoming: {
            body: new ReadableStream<Uint8Array>({
              start(controller): void {
                controller.enqueue(encoder.encode('{"ok":'));
                controller.error(new Error("truncated chunked body"));
              },
            }),
            headers: jsonHeaders,
          },
        }),
      ));

    it("dies instead of answering invalid JSON", ({ decoded }) => {
      expect(decoded).toStrictEqual(Exit.die(new Error("truncated chunked body")));
    });
  });

  describe("JSON that does not parse", () => {
    const it = test.extend("decoded", () =>
      Effect.runPromiseExit(
        readJson({
          expectedOrigin: origin,
          incoming: { body: new Blob(["{"]).stream(), headers: jsonHeaders },
        }),
      ));

    it("is invalid JSON", ({ decoded }) => {
      expect(decoded).toStrictEqual(Exit.fail(new RequestRejected({ reason: "invalid_json" })));
    });
  });

  describe("a missing body", () => {
    const it = test.extend("decoded", () =>
      Effect.runPromiseExit(
        readJson({ expectedOrigin: origin, incoming: { body: null, headers: jsonHeaders } }),
      ));

    it("is required", ({ decoded }) => {
      expect(decoded).toStrictEqual(Exit.fail(new RequestRejected({ reason: "body_required" })));
    });
  });

  describe("a body past the limit while it is read", () => {
    const it = test.extend("decoded", () =>
      Effect.runPromiseExit(
        readJson({
          expectedOrigin: origin,
          incoming: { body: new Blob(["12345"]).stream(), headers: jsonHeaders },
          limit: 4,
        }),
      ));

    it("is too large", ({ decoded }) => {
      expect(decoded).toStrictEqual(Exit.fail(new RequestRejected({ reason: "body_too_large" })));
    });
  });

  describe.for([
    [
      "another origin",
      { "content-type": "application/json", origin: "https://other.example" },
      "origin_denied",
    ],
    [
      "a cross-site fetch",
      { "content-type": "application/json", origin, "sec-fetch-site": "cross-site" },
      "origin_denied",
    ],
    ["a plain body", { "content-type": "text/plain", origin }, "json_required"],
    [
      "a declared length past the limit",
      { "content-length": "16385", "content-type": "application/json", origin },
      "body_too_large",
    ],
  ] as const)("%s", ([, requestHeaders, reason]) => {
    const it = test.extend("decoded", () =>
      Effect.runPromiseExit(
        readJson({
          expectedOrigin: origin,
          incoming: {
            body: new Blob(["{}"]).stream(),
            headers: new Headers(requestHeaders),
          },
        }),
      ));

    it("is refused before the body is read", ({ decoded }) => {
      expect(decoded).toStrictEqual(Exit.fail(new RequestRejected({ reason })));
    });
  });
});
