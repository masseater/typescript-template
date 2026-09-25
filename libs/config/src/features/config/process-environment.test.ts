import { describe, expect, test } from "vite-plus/test";

import { definedEnvironment, optionalSetting } from "./process-environment.ts";

const CARRIED_VARIABLE = "TEMPLATE_PROCESS_ENVIRONMENT_CARRIED";

describe("optionalSetting", () => {
  describe("a variable the process does not carry", () => {
    const it = test.extend("settingRead", () =>
      optionalSetting("TEMPLATE_PROCESS_ENVIRONMENT_NEVER_SET"));

    it("answers nothing", ({ settingRead }) => {
      expect(settingRead).toBe(undefined);
    });
  });

  describe("a variable the process carries", () => {
    const it = test.extend("settingRead", () => optionalSetting(CARRIED_VARIABLE));

    it("answers the value the process carries", ({ settingRead }) => {
      expect(settingRead).toBe("carried");
    });
  });
});

describe("definedEnvironment", () => {
  const it = test.extend("environmentRead", () =>
    Object.entries(definedEnvironment()).filter(([variable]) => variable === CARRIED_VARIABLE));

  it("copies the variables the process carries", ({ environmentRead }) => {
    expect(environmentRead).toStrictEqual([[CARRIED_VARIABLE, "carried"]]);
  });
});
