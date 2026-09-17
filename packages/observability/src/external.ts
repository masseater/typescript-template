import type { Attributes } from "./protocol.ts";

export function externalAttributes(
  operation: "email",
  status: number | undefined,
  failed: boolean,
): Attributes {
  return {
    "external.operation": operation,
    "external.outcome": failed ? "failure" : "success",
    ...(status === undefined ? {} : { "http.response.status_code": status }),
  };
}
