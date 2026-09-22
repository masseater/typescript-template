import { AdminMfaRequired } from "@repo/auth";
import { httpStatus } from "@repo/config";
import { Option } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { denied, sessionPresence } from "./access-decision.ts";

describe("wiki access after session verify", () => {
  it("keeps MFA enrollment as signed-in so denial sends to /security", () => {
    expect.hasAssertions();
    const session = sessionPresence(new AdminMfaRequired());
    expect(session).toStrictEqual(Option.some({ strong: false }));
    const response = denied("/guides", Option.isSome(session));
    expect(response.status).toBe(httpStatus.found);
    expect(response.headers.get("location")).toBe("/security");
  });

  it("sends unauthenticated visitors to /login", () => {
    expect.hasAssertions();
    const session = sessionPresence({ _tag: "SessionRequired" });
    expect(session).toStrictEqual(Option.none());
    const response = denied("/guides", Option.isSome(session));
    expect(response.status).toBe(httpStatus.found);
    expect(response.headers.get("location")).toBe("/login");
  });

  it("treats /security as allowed for a weak signed-in session", () => {
    expect.hasAssertions();
    const current = sessionPresence({ strong: false });
    const path = "/security";
    const allowed = Option.isSome(current) && (current.value.strong || path === "/security");
    expect(allowed).toBe(true);
  });
});
