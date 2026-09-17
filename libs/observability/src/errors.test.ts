import { describe, expect, it } from "vite-plus/test";
import { errorAttributes, errorFingerprint } from "./errors.ts";

const deepFrames = 6;
const fingerprintPattern = /^[0-9a-f]{8}$/u;

function fingerprintOf(error: unknown): string {
  return errorAttributes(error)["error.fingerprint"];
}

describe("error attributes", () => {
  it("keeps useful error locations without messages, arguments or local directory names", () => {
    expect.hasAssertions();
    const error = new TypeError("private@example.test password=secret");
    error.stack =
      "TypeError: private@example.test password=secret\n at check (/Users/private/app.js:12:3)\n at https://app.test/assets/web.js:34:5";
    const attributes = errorAttributes(error);
    expect({
      locations: attributes["error.locations"],
      type: attributes["error.type"],
    }).toStrictEqual({
      locations: "app.js:12:3\n/assets/web.js:34:5",
      type: "TypeError",
    });
    expect(JSON.stringify(attributes)).not.toMatch(/private|secret|Users/u);
  });

  it("does not serialize thrown objects or custom error names", () => {
    expect.hasAssertions();
    expect(errorAttributes({ password: "secret" })).toStrictEqual({
      "error.fingerprint": errorFingerprint("Error", ""),
      "error.locations": "",
      "error.type": "Error",
    });
    const error = new Error("secret");
    error.name = "private@example.test";
    expect(errorAttributes(error)["error.type"]).toBe("Error");
  });
});

describe("error fingerprints", () => {
  it("groups the same failure site regardless of message and deeper frames", () => {
    expect.hasAssertions();
    const first = new TypeError("first@example.test");
    first.stack = `TypeError\n${Array.from({ length: deepFrames }, (_unused, index) => ` at a.js:${index + 1}:1`).join("\n")}`;
    const second = new TypeError("second@example.test");
    second.stack = `${first.stack.split("\n").slice(0, deepFrames).join("\n")}\n at b.js:9:9`;
    expect(fingerprintOf(first)).toMatch(fingerprintPattern);
    expect(fingerprintOf(second)).toBe(fingerprintOf(first));
  });

  it("separates different failure sites and error types", () => {
    expect.hasAssertions();
    const first = new TypeError("first@example.test");
    first.stack = "TypeError\n at a.js:1:1";
    const moved = new TypeError("first@example.test");
    moved.stack = "TypeError\n at a.js:2:1";
    expect(fingerprintOf(moved)).not.toBe(fingerprintOf(first));
    expect(fingerprintOf(new RangeError("range"))).not.toBe(fingerprintOf(new TypeError("type")));
  });
});
