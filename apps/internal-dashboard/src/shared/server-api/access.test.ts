import { AdminMfaRequired } from "@repo/auth";
import { httpStatus } from "@repo/config";
import { Option } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { decideAccess, denied, sessionPresence } from "./access-decision.ts";

describe("wiki access after session verify", () => {
  it("keeps MFA enrollment as signed-in so denial sends to /security", () => {
    expect.hasAssertions();
    const session = sessionPresence(AdminMfaRequired.make());
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

  it("lets a weak signed-in session reach /security only", () => {
    expect.hasAssertions();
    const weak = sessionPresence({ strong: false });
    expect(decideAccess("/security", weak)).toStrictEqual(Option.none());
    const denial = decideAccess("/guides", weak);
    expect(Option.getOrUndefined(denial)?.headers.get("location")).toBe("/security");
  });

  it("lets a strong session through and turns an anonymous API call away", () => {
    expect.hasAssertions();
    expect(decideAccess("/guides", sessionPresence({ strong: true }))).toStrictEqual(Option.none());
    const denial = decideAccess("/api/search", Option.none());
    expect(Option.getOrUndefined(denial)?.status).toBe(httpStatus.unauthorized);
  });
});
