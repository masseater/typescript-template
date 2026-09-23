import { APPLICATION } from "@repo/config";
import { describe, expect, test } from "vite-plus/test";

import { applicationsExcept, isSecretFileName, privatePath } from "./private-path.ts";

const repositoryRoot = "/repo";

describe("privatePath", () => {
  const it = test
    .extend("foreignApplications", () => applicationsExcept(APPLICATION.user))
    .extend("privateCandidates", () =>
      [
        "infra/cloudflare/src/features/cloudflare/cli.ts",
        "tools/dev/src/features/dev/cli.ts",
        "apps/service-admin/src/entry.ts",
        "libs/db/src/features/db/admin.ts",
        "libs/db/src/features/db/remote-cli.ts",
        "libs/db/src/features/db/testing.ts",
        ".env.local",
        "certs/app.pem",
      ].map((candidatePath) =>
        privatePath({
          application: APPLICATION.user,
          candidatePath: `${repositoryRoot}/${candidatePath}`,
          repositoryRoot,
        }),
      ),
    )
    .extend("ownApplicationEntry", () =>
      privatePath({
        application: APPLICATION.user,
        candidatePath: `${repositoryRoot}/apps/service-member/src/entry.ts`,
        repositoryRoot,
      }),
    )
    .extend("adminDatabaseModule", () =>
      privatePath({
        application: APPLICATION.admin,
        candidatePath: `${repositoryRoot}/libs/db/src/features/db/admin.ts`,
        repositoryRoot,
      }),
    )
    .extend("devVarsFile", () => isSecretFileName(".dev.vars"))
    .extend("readmeFile", () => isSecretFileName("readme.md"));

  it("keeps the other applications off the member surface", ({ foreignApplications }) => {
    expect(foreignApplications).toStrictEqual([APPLICATION.admin, APPLICATION.wiki]);
  });

  it("keeps infra, tools, secrets, and other apps off the member surface", ({
    privateCandidates,
  }) => {
    expect(privateCandidates).toStrictEqual([true, true, true, true, true, true, true, true]);
  });

  it("lets an app read its own sources", ({ ownApplicationEntry }) => {
    expect(ownApplicationEntry).toBe(false);
  });

  it("lets admin read the admin database module", ({ adminDatabaseModule }) => {
    expect(adminDatabaseModule).toBe(false);
  });

  it("treats dev vars as a secret file", ({ devVarsFile }) => {
    expect(devVarsFile).toBe(true);
  });

  it("leaves a readme readable", ({ readmeFile }) => {
    expect(readmeFile).toBe(false);
  });
});
