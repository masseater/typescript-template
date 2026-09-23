import { describe, expect, test } from "vite-plus/test";

import { worktreeLocationOf } from "./worktree-location.ts";

describe("worktreeLocationOf", () => {
  const it = test
    .extend("httpsLocation", () =>
      worktreeLocationOf({
        home: "/home/dev",
        name: "fix-login",
        originUrl: "https://github.com/acme/widgets.git",
      }))
    .extend("scpLocation", () =>
      worktreeLocationOf({
        home: "/home/dev",
        name: "fix-login",
        originUrl: "git@github.com:acme/widgets.git",
      }),
    )
    .extend("sshUrlLocation", () =>
      worktreeLocationOf({
        home: "/home/dev",
        name: "fix-login",
        originUrl: "ssh://git@github.com:22/acme/widgets",
      }),
    )
    .extend("nestedNameLocation", () =>
      worktreeLocationOf({
        home: "/home/dev",
        name: "claude/fix-login",
        originUrl: "https://github.com/acme/widgets",
      }),
    )
    .extend("escapingNameLocation", () =>
      worktreeLocationOf({
        home: "/home/dev",
        name: "../../escape",
        originUrl: "https://github.com/acme/widgets",
      }),
    )
    .extend("localPathLocation", () =>
      worktreeLocationOf({ home: "/home/dev", name: "fix-login", originUrl: "/srv/widgets.git" }),
    );

  it("places an https origin under the gwq layout of host, owner and repository", ({
    httpsLocation,
  }) => {
    expect(httpsLocation).toBe("/home/dev/worktrees/github.com/acme/widgets/fix-login");
  });

  it("places an scp-style origin at the same location as its https form", ({ scpLocation }) => {
    expect(scpLocation).toBe("/home/dev/worktrees/github.com/acme/widgets/fix-login");
  });

  it("drops the user and port of an ssh url", ({ sshUrlLocation }) => {
    expect(sshUrlLocation).toBe("/home/dev/worktrees/github.com/acme/widgets/fix-login");
  });

  it("keeps a slash-separated name as nested directories", ({ nestedNameLocation }) => {
    expect(nestedNameLocation).toBe("/home/dev/worktrees/github.com/acme/widgets/claude/fix-login");
  });

  it("refuses a name that climbs out of the repository directory", ({ escapingNameLocation }) => {
    expect(escapingNameLocation).toBe(undefined);
  });

  it("refuses an origin without a host to place it under", ({ localPathLocation }) => {
    expect(localPathLocation).toBe(undefined);
  });
});
