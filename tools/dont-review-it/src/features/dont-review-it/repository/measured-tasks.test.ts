import { measured } from "@repo/vite-config";
import { describe, expect, it } from "vite-plus/test";

import { unmeasuredTasks } from "./measured-tasks.ts";
import { configuredDirectories, workspaceTasks } from "./tasks.ts";

describe("cached tasks", () => {
  it("are reported when they would run without the telemetry settings", () => {
    expect(
      unmeasuredTasks({
        bare: "vp test run",
        steps: ["vp check", "vp test run"],
        cached: { command: "vp test run" },
        partly: { command: "vp test run", env: ["MST_TELEMETRY"] },
        uncached: { cache: false, command: "vp dev" },
        stage: { command: [], dependsOn: ["check:code"] },
      }),
    ).toStrictEqual(["bare", "steps", "cached", "partly"]);
  });

  it("are left alone once measured", () => {
    expect(
      unmeasuredTasks(
        measured({
          bare: "vp test run",
          cached: { command: "vp test run", env: ["CI"] },
          uncached: { cache: false, command: "vp dev" },
        }),
      ),
    ).toStrictEqual([]);
  });

  it("hand every repository task the telemetry settings", () => {
    expect(
      configuredDirectories.flatMap((directory) =>
        unmeasuredTasks(workspaceTasks[directory] ?? {}).map((name) => `${directory}#${name}`),
      ),
    ).toStrictEqual([]);
  });
});
