import { APPLICATION } from "@repo/config";
import { describe, expect, it } from "vite-plus/test";

import { applicationsExcept, isSecretFileName, privatePath } from "./private-path.ts";

const repositoryRoot = "/repo";

describe("privatePath", () => {
  it("keeps infra, tools, secrets, and other apps off the member surface", () => {
    expect.hasAssertions();
    expect(applicationsExcept(APPLICATION.user)).toStrictEqual([
      APPLICATION.admin,
      APPLICATION.wiki,
    ]);
    expect(
      [
        "infra/cloudflare/src/cli.ts",
        "tools/dev/src/cli.ts",
        "apps/service-admin/src/entry.ts",
        "libs/db/src/admin.ts",
        "libs/db/src/remote-cli.ts",
        "libs/db/src/testing.ts",
        ".env.local",
        "certs/app.pem",
      ].map((candidatePath) =>
        privatePath({
          application: APPLICATION.user,
          candidatePath: `${repositoryRoot}/${candidatePath}`,
          repositoryRoot,
        }),
      ),
    ).toStrictEqual([true, true, true, true, true, true, true, true]);
  });

  it("lets an app read its own sources and lets admin read the admin database module", () => {
    expect.hasAssertions();
    expect(
      privatePath({
        application: APPLICATION.user,
        candidatePath: `${repositoryRoot}/apps/service-member/src/entry.ts`,
        repositoryRoot,
      }),
    ).toBe(false);
    expect(
      privatePath({
        application: APPLICATION.admin,
        candidatePath: `${repositoryRoot}/libs/db/src/admin.ts`,
        repositoryRoot,
      }),
    ).toBe(false);
    expect(isSecretFileName(".dev.vars")).toBe(true);
    expect(isSecretFileName("readme.md")).toBe(false);
  });
});
