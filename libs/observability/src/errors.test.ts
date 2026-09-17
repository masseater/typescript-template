import { expect, test } from "vite-plus/test";
import { errorAttributes, errorFingerprint } from "./errors.ts";

test("keeps useful error locations without messages, arguments or local directory names", () => {
  const error = new TypeError("private@example.test password=secret");
  error.stack =
    "TypeError: private@example.test password=secret\n at check (/Users/private/app.js:12:3)\n at https://app.test/assets/web.js:34:5";
  const attributes = errorAttributes(error);
  expect(attributes["error.type"]).toBe("TypeError");
  expect(attributes["error.locations"]).toBe("app.js:12:3\n/assets/web.js:34:5");
  expect(JSON.stringify(attributes)).not.toMatch(/private|secret|Users/);
});

test("the fingerprint groups the same failure site regardless of message and deeper frames", () => {
  const first = new TypeError("first@example.test");
  first.stack = `TypeError\n${Array.from({ length: 6 }, (_, index) => ` at a.js:${index + 1}:1`).join("\n")}`;
  const second = new TypeError("second@example.test");
  second.stack = `${first.stack.split("\n").slice(0, 6).join("\n")}\n at b.js:9:9`;
  const moved = new TypeError("first@example.test");
  moved.stack = "TypeError\n at a.js:2:1";
  expect(errorAttributes(first)["error.fingerprint"]).toMatch(/^[0-9a-f]{8}$/);
  expect(errorAttributes(second)["error.fingerprint"]).toBe(
    errorAttributes(first)["error.fingerprint"],
  );
  expect(errorAttributes(moved)["error.fingerprint"]).not.toBe(
    errorAttributes(first)["error.fingerprint"],
  );
  expect(errorAttributes(new RangeError())["error.fingerprint"]).not.toBe(
    errorAttributes(new TypeError())["error.fingerprint"],
  );
});

test("does not serialize thrown objects or custom error names", () => {
  expect(errorAttributes({ password: "secret" })).toEqual({
    "error.type": "Error",
    "error.locations": "",
    "error.fingerprint": errorFingerprint("Error", ""),
  });
  const error = new Error("secret");
  error.name = "private@example.test";
  expect(errorAttributes(error)["error.type"]).toBe("Error");
});
