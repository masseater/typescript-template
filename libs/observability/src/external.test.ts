import { describe, expect, it } from "vitest";
import { externalAttributes } from "./external.ts";
import { httpStatus } from "./http-status.ts";

describe("external attributes", () => {
  it("non-HTTP external operations never manufacture an HTTP status", () => {
    expect.hasAssertions();
    expect(externalAttributes("email", undefined, false)).toStrictEqual({
      "external.operation": "email",
      "external.outcome": "success",
    });
    expect(externalAttributes("email", undefined, true)).toStrictEqual({
      "external.operation": "email",
      "external.outcome": "failure",
    });
    expect(externalAttributes("ai", undefined, false)).toStrictEqual({
      "external.operation": "ai",
      "external.outcome": "success",
    });
  });

  it("hTTP external operations retain the actual response status", () => {
    expect.hasAssertions();
    expect(externalAttributes("email", httpStatus.accepted, false)).toStrictEqual({
      "external.operation": "email",
      "external.outcome": "success",
      "http.response.status_code": httpStatus.accepted,
    });
    expect(externalAttributes("email", httpStatus.serviceUnavailable, true)).toStrictEqual({
      "external.operation": "email",
      "external.outcome": "failure",
      "http.response.status_code": httpStatus.serviceUnavailable,
    });
  });
});
