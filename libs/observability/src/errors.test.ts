import { Effect, Schema } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { errorAttributes, errorFingerprint, fingerprintIdentity } from "./errors.ts";

const encodeJson = (value: unknown): string =>
  Effect.runSync(
    Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))(value).pipe(Effect.orDie),
  );

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
    expect(encodeJson(attributes)).not.toMatch(/private|secret|Users/u);
  });

  it("does not serialize thrown objects or unsafe custom error names", () => {
    expect.hasAssertions();
    expect(errorAttributes({ password: "secret" })).toStrictEqual({
      "error.fingerprint": errorFingerprint(fingerprintIdentity({ password: "secret" }), ""),
      "error.locations": "",
    });
    const error = new Error("secret");
    error.name = "private@example.test";
    error.stack = "private@example.test";
    expect(errorAttributes(error)).toStrictEqual({
      "error.fingerprint": errorFingerprint("private@example.test", ""),
      "error.locations": "",
    });
  });

  it("reports a validated custom error name without collapsing it to Error", () => {
    expect.hasAssertions();
    const error = new Error("secret");
    error.name = "DatabaseTimeout";
    error.stack = "DatabaseTimeout";
    expect(errorAttributes(error)["error.type"]).toBe("DatabaseTimeout");
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

  it("keeps unknown throwables on distinct fingerprints", () => {
    expect.hasAssertions();
    const plain = new Error("plain");
    plain.stack = "Error";
    const custom = new Error("custom");
    custom.name = "DatabaseTimeout";
    custom.stack = "DatabaseTimeout";
    const unsafe = new Error("unsafe");
    unsafe.name = "private@example.test";
    unsafe.stack = "private@example.test";
    expect(fingerprintOf({ password: "secret" })).not.toBe(fingerprintOf("boom"));
    expect(fingerprintOf("boom")).not.toBe(fingerprintOf(42));
    expect(fingerprintOf(plain)).not.toBe(fingerprintOf({}));
    expect(fingerprintOf(custom)).not.toBe(fingerprintOf(plain));
    expect(fingerprintOf(unsafe)).not.toBe(fingerprintOf(plain));
    expect(fingerprintOf(unsafe)).not.toBe(fingerprintOf(custom));
  });
});
