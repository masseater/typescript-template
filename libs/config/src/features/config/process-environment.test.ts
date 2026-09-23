import { env as processEnvironment } from "node:process";

import { describe, expect, test } from "vite-plus/test";

import { definedEnvironment, optionalSetting } from "./process-environment.ts";

describe("optionalSetting", () => {
  describe("a variable the process does not carry", () => {
    const it = test.extend("settingRead", () =>
      optionalSetting("TEMPLATE_PROCESS_ENVIRONMENT_NEVER_SET"));

    it("answers nothing", ({ settingRead }) => {
      expect(settingRead).toBe(undefined);
    });
  });

  describe("a variable the process carries", () => {
    const it = test.extend("settingRead", () => optionalSetting("PATH"));

    it("answers the value the process carries", ({ settingRead }) => {
      expect(settingRead).toBe(processEnvironment["PATH"]);
    });
  });
});

describe("definedEnvironment", () => {
  const it = test.extend("environmentRead", () => definedEnvironment());

  it("copies every variable the process carries", ({ environmentRead }) => {
    expect(environmentRead).toStrictEqual({ ...processEnvironment });
  });
});
