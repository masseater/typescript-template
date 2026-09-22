import { MergifyReporter } from "@mergifyio/vitest";
import type { TestModule } from "vitest/node";

class RequiredMergifyReporter extends MergifyReporter {
  override async onTestRunEnd(
    testModules: ReadonlyArray<TestModule>,
    unhandledErrors: ReadonlyArray<unknown>,
    reason: "passed" | "failed" | "interrupted",
  ): Promise<void> {
    await super.onTestRunEnd(testModules, unhandledErrors, reason);
    const token = process.env["MERGIFY_TOKEN"];
    if (!token) {
      return;
    }
    const ci = process.env["CI"];
    if (ci === undefined || ci === "") {
      return;
    }
    if (this.getSink() === undefined) {
      throw new Error(
        "MERGIFY_TOKEN is set in CI but Mergify CI Insights did not activate; check the token ci scope, repository detection, and @mergifyio/ci-native",
      );
    }
  }
}

const mergifyVitest = (): {
  readonly reporters: readonly ["default", RequiredMergifyReporter];
} => ({
  reporters: ["default", new RequiredMergifyReporter()],
});

export { mergifyVitest, RequiredMergifyReporter };
