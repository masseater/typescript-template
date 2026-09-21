import { Cause, Effect, Exit } from "effect";
import { describe, expect, test } from "vite-plus/test";

import { RequestRejected, readJson } from "./request.ts";

const origin = "http://localhost";
const encoder = new TextEncoder();

const headersOf = (headers: Readonly<Record<string, string>>): Headers => new Headers(headers);

const jsonHeaders = headersOf({ "content-type": "application/json", origin });

async function* bodyOf(parts: readonly string[]): AsyncGenerator<Uint8Array> {
  for (const part of parts) {
    yield encoder.encode(part);
  }
}

async function* truncatedBody(): AsyncGenerator<Uint8Array> {
  yield encoder.encode('{"ok":');
  throw new Error("truncated chunked body");
}

const read = (incoming: {
  readonly body: AsyncIterable<Uint8Array> | null;
  readonly headers?: Headers;
  readonly limit?: number;
}): Promise<Exit.Exit<unknown, RequestRejected>> =>
  Effect.runPromiseExit(
    readJson({
      expectedOrigin: origin,
      incoming: { body: incoming.body, headers: incoming.headers ?? jsonHeaders },
      ...(incoming.limit === undefined ? {} : { limit: incoming.limit }),
    }),
  );

const rejected = (
  exit: Exit.Exit<unknown, RequestRejected>,
): RequestRejected["reason"] | undefined => {
  if (exit._tag !== "Failure") {
    return undefined;
  }
  const error = Cause.squash(exit.cause);
  return error instanceof RequestRejected ? error.reason : undefined;
};

describe("readJson", () => {
  describe("a body split across chunks", () => {
    const it = test.extend("decoded", async () => read({ body: bodyOf(['{"a":', "1}"]) }));

    it("parses the joined JSON", ({ decoded }) => {
      expect(decoded).toStrictEqual(Exit.succeed({ a: 1 }));
    });
  });

  describe("a chunked body that ends early", () => {
    const it = test.extend("decoded", async () => read({ body: truncatedBody() }));

    it("dies instead of answering invalid JSON", ({ decoded }) => {
      expect(decoded._tag).toBe("Failure");
      expect(rejected(decoded)).toBeUndefined();
      if (decoded._tag === "Failure") {
        expect(Cause.squash(decoded.cause)).toStrictEqual(new Error("truncated chunked body"));
      }
    });
  });

  describe("JSON that does not parse", () => {
    const it = test.extend("decoded", async () => read({ body: bodyOf(["{"]) }));

    it("is invalid JSON", ({ decoded }) => {
      expect(rejected(decoded)).toBe("invalid_json");
    });
  });

  describe("a missing body", () => {
    const it = test.extend("decoded", async () => read({ body: null }));

    it("is required", ({ decoded }) => {
      expect(rejected(decoded)).toBe("body_required");
    });
  });

  describe("a body past the limit while it is read", () => {
    const it = test.extend("decoded", async () =>
      read({ body: bodyOf(["12345"]), headers: jsonHeaders, limit: 4 }));

    it("is too large", ({ decoded }) => {
      expect(rejected(decoded)).toBe("body_too_large");
    });
  });

  describe.for([
    [
      "another origin",
      headersOf({ "content-type": "application/json", origin: "https://other.example" }),
      "origin_denied",
    ],
    [
      "a cross-site fetch",
      headersOf({
        "content-type": "application/json",
        origin,
        "sec-fetch-site": "cross-site",
      }),
      "origin_denied",
    ],
    ["a plain body", headersOf({ "content-type": "text/plain", origin }), "json_required"],
    [
      "a declared length past the limit",
      headersOf({ "content-length": "16385", "content-type": "application/json", origin }),
      "body_too_large",
    ],
  ] as const)("%s", ([, headers, reason]) => {
    const it = test.extend("decoded", async () => read({ body: bodyOf(["{}"]), headers }));

    it("is refused before the body is read", ({ decoded }) => {
      expect(rejected(decoded)).toBe(reason);
    });
  });
});
