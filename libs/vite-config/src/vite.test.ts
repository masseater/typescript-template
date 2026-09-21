import { describe, expect, it } from "vite-plus/test";

import { appRun, effectRun, lifecycle } from "./vite.ts";

describe("lifecycle", () => {
  it("fills omitted stages with inherited gates only", () => {
    expect.hasAssertions();
    expect(lifecycle({ prepush: ["check:effect"] })).toStrictEqual({
      precommit: { command: [], dependsOn: [] },
      prepush: { command: [], dependsOn: ["precommit", "check:effect"] },
      prepr: { command: [], dependsOn: ["prepush"] },
      premerge: { command: [], dependsOn: [] },
      prerelease: { command: [], dependsOn: ["prepr", "premerge"] },
    });
  });

  it("keeps commit and release checks on the stages that declare them", () => {
    expect.hasAssertions();
    expect(
      lifecycle({ precommit: ["check:staged"], prerelease: ["verify:account"] }),
    ).toStrictEqual({
      precommit: { command: [], dependsOn: ["check:staged"] },
      prepush: { command: [], dependsOn: ["precommit"] },
      prepr: { command: [], dependsOn: ["prepush"] },
      premerge: { command: [], dependsOn: [] },
      prerelease: { command: [], dependsOn: ["prepr", "premerge", "verify:account"] },
    });
  });

  it("keeps the effect workspace on typecheck before push", () => {
    expect.hasAssertions();
    expect(effectRun.tasks.prepush).toStrictEqual({
      command: [],
      dependsOn: ["precommit", "check:effect"],
    });
  });

  it("starts and previews an app without a package script", () => {
    expect.hasAssertions();
    expect(appRun.tasks.dev).toStrictEqual({ cache: false, command: "vp dev" });
    expect(appRun.tasks.preview).toStrictEqual({ cache: false, command: "vp preview" });
  });
});
