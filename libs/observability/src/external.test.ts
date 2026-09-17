import { expect, test } from "vitest";
import { externalAttributes } from "./external.ts";

test("non-HTTP external operations never manufacture an HTTP status", () => {
  expect(externalAttributes("email", undefined, false)).toEqual({
    "external.operation": "email",
    "external.outcome": "success",
  });
  expect(externalAttributes("email", undefined, true)).toEqual({
    "external.operation": "email",
    "external.outcome": "failure",
  });
  expect(externalAttributes("ai", undefined, false)).toEqual({
    "external.operation": "ai",
    "external.outcome": "success",
  });
});

test("HTTP external operations retain the actual response status", () => {
  expect(externalAttributes("email", 202, false)).toEqual({
    "external.operation": "email",
    "external.outcome": "success",
    "http.response.status_code": 202,
  });
  expect(externalAttributes("email", 503, true)).toEqual({
    "external.operation": "email",
    "external.outcome": "failure",
    "http.response.status_code": 503,
  });
});
