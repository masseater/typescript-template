import { describe, expect, it } from "vite-plus/test";

import { approvedRegistries, componentsConfigs, registryViolations } from "./shadcn-registries.ts";

describe("shadcn registries", () => {
  it("rejects a registry that has not been adopted", () => {
    expect.hasAssertions();
    const violations = registryViolations([
      {
        config: { registries: { "@magicui": "https://magicui.design/r/{name}.json" } },
        file: "libs/ui/components.json",
      },
    ]);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain("@magicui");
  });

  it("rejects an adopted namespace that points somewhere else", () => {
    expect.hasAssertions();
    const violations = registryViolations([
      {
        config: { registries: { "@react-bits": "https://example.com/r/{name}.json" } },
        file: "libs/ui/components.json",
      },
    ]);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain("@react-bits");
  });

  it("rejects an application that pulls parts in by itself", () => {
    expect.hasAssertions();
    const violations = registryViolations([
      { config: { registries: approvedRegistries }, file: "apps/service-admin/components.json" },
    ]);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain("libs/ui");
  });

  it("rejects registries that are not a namespace table", () => {
    expect.hasAssertions();
    expect(
      registryViolations([
        { config: { registries: ["@react-bits"] }, file: "libs/ui/components.json" },
      ]),
    ).toHaveLength(1);
  });

  it("accepts the adopted registries in the parts owner", () => {
    expect.hasAssertions();
    expect(
      registryViolations([
        { config: { registries: approvedRegistries }, file: "libs/ui/components.json" },
      ]),
    ).toStrictEqual([]);
  });

  it("repository components.json files declare only adopted registries", () => {
    expect.hasAssertions();
    expect(componentsConfigs.map(({ file }) => file)).toContain("libs/ui/components.json");
    expect(registryViolations(componentsConfigs)).toStrictEqual([]);
  });
});
