import { describe, expect, it } from "vite-plus/test";
import type { UserConfig } from "vite-plus";
import { field } from "./dependencies.ts";

const manifests: Readonly<Record<string, unknown>> = import.meta.glob("../../package.json", {
  eager: true,
  import: "default",
});

const rootConfig: Readonly<Record<string, Readonly<UserConfig>>> = import.meta.glob(
  "../../vite.config.ts",
  { eager: true, import: "default" },
);

function script(name: string): unknown {
  return field(field(manifests["../../package.json"], "scripts"), name);
}

describe("git hooks", () => {
  it("git hooks run the verified package scripts", () => {
    expect.hasAssertions();
    expect(
      import.meta.glob("../../.vite-hooks/pre-*", { eager: true, import: "default" }),
    ).toStrictEqual({
      "../../.vite-hooks/pre-commit": "vp run precommit\n",
      "../../.vite-hooks/pre-push": "vp run prepush\n",
    });
    expect(script("precommit")).toBe("vp run check");
    expect(rootConfig["../../vite.config.ts"]?.run?.tasks?.["check"]).toContain("vp check");
    expect(script("prepush")).toContain("vp test run --changed origin/main");
  });
});
