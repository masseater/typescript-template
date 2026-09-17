import { expect, test } from "vite-plus/test";
import { errorAttributes } from "./errors.ts";

test("keeps useful error locations without messages, arguments or local directory names", () => {
  const error = new TypeError("private@example.test password=secret");
  error.stack =
    "TypeError: private@example.test password=secret\n at check (/Users/private/app.js:12:3)\n at https://app.test/assets/web.js:34:5";
  const attributes = errorAttributes(error);
  expect(attributes["error.type"]).toBe("TypeError");
  expect(attributes["error.locations"]).toBe("app.js:12:3\n/assets/web.js:34:5");
  expect(JSON.stringify(attributes)).not.toMatch(/private|secret|Users/);
});

test("does not serialize thrown objects or custom error names", () => {
  expect(errorAttributes({ password: "secret" })).toEqual({
    "error.type": "Error",
    "error.locations": "",
  });
  const error = new Error("secret");
  error.name = "private@example.test";
  expect(errorAttributes(error)["error.type"]).toBe("Error");
});
