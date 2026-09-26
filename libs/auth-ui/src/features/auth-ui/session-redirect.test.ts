import { ROLE } from "@repo/config";
import { describe, expect, test } from "vite-plus/test";

import { sessionRedirect } from "./session-redirect.ts";

const settled = { error: undefined, loading: false } as const;
const strongMember = { strong: true, user: { role: ROLE.member } } as const;
const weakAdministrator = { strong: false, user: { role: ROLE.admin } } as const;
const wikiPage = { href: "/wiki", pathname: "/wiki", role: undefined, securityExempt: false };
const nestedWikiPage = { ...wikiPage, href: "/wiki/a?b=1", pathname: "/wiki/a" };
const exemptSecurityPage = {
  href: "/security",
  pathname: "/security",
  role: ROLE.admin,
  securityExempt: true,
};
const guardedSecurityPage = { ...exemptSecurityPage, role: undefined, securityExempt: false };
const administratorPage = { ...exemptSecurityPage, href: "/users", pathname: "/users" };

describe("session gate redirect", () => {
  const it = test
    .extend("theRedirectWhileLoading", () =>
      sessionRedirect({ ...settled, loading: true, session: undefined }, wikiPage))
    .extend("theRedirectOfAFailedRead", () =>
      sessionRedirect({ ...settled, error: "失敗", session: undefined }, wikiPage),
    )
    .extend("theRedirectOfAStrongSession", () =>
      sessionRedirect({ ...settled, session: strongMember }, wikiPage),
    )
    .extend("theRedirectOfAWeakSession", () =>
      sessionRedirect({ ...settled, session: weakAdministrator }, wikiPage),
    )
    .extend("theRedirectOfASignedOutVisitor", () =>
      sessionRedirect({ ...settled, session: undefined }, nestedWikiPage),
    )
    .extend("theRedirectOfAWeakSessionOnAnExemptSecurityPage", () =>
      sessionRedirect({ ...settled, session: weakAdministrator }, exemptSecurityPage),
    )
    .extend("theRedirectOfAWeakSessionOnAGuardedSecurityPage", () =>
      sessionRedirect({ ...settled, session: weakAdministrator }, guardedSecurityPage),
    )
    .extend("theRedirectOfASignedOutVisitorOnTheSecurityPage", () =>
      sessionRedirect({ ...settled, session: undefined }, exemptSecurityPage),
    )
    .extend("theRedirectOfAStrongSessionWithoutTheRole", () =>
      sessionRedirect({ ...settled, session: strongMember }, administratorPage),
    );

  it("stays while the session is loading", ({ theRedirectWhileLoading }) => {
    expect(theRedirectWhileLoading).toBe(undefined);
  });

  it("stays when the session could not be read", ({ theRedirectOfAFailedRead }) => {
    expect(theRedirectOfAFailedRead).toBe(undefined);
  });

  it("stays for a strong session without a role requirement", ({ theRedirectOfAStrongSession }) => {
    expect(theRedirectOfAStrongSession).toBe(undefined);
  });

  it("sends a weak session to the security page", ({ theRedirectOfAWeakSession }) => {
    expect(theRedirectOfAWeakSession).toBe("/security");
  });

  it("sends a signed-out visitor to the login page for the current address", ({
    theRedirectOfASignedOutVisitor,
  }) => {
    expect(theRedirectOfASignedOutVisitor).toBe("/login?redirect=%2Fwiki%2Fa%3Fb%3D1");
  });

  it("lets a weak session stay on the security page when it is exempt", ({
    theRedirectOfAWeakSessionOnAnExemptSecurityPage,
  }) => {
    expect(theRedirectOfAWeakSessionOnAnExemptSecurityPage).toBe(undefined);
  });

  it("sends a weak session away from the security page when it is not exempt", ({
    theRedirectOfAWeakSessionOnAGuardedSecurityPage,
  }) => {
    expect(theRedirectOfAWeakSessionOnAGuardedSecurityPage).toBe("/security");
  });

  it("sends a signed-out visitor on the security page to the login page", ({
    theRedirectOfASignedOutVisitorOnTheSecurityPage,
  }) => {
    expect(theRedirectOfASignedOutVisitorOnTheSecurityPage).toBe("/login?redirect=%2Fsecurity");
  });

  it("sends a strong session without the required role to the security page", ({
    theRedirectOfAStrongSessionWithoutTheRole,
  }) => {
    expect(theRedirectOfAStrongSessionWithoutTheRole).toBe("/security");
  });
});
