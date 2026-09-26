import { runCommand } from "@repo/cli";
import { recordedRequests, subcommandNamesOf } from "@repo/cli/testing";
import { Effect } from "effect";
import { describe, expect, it, test } from "vite-plus/test";

import { deploymentCommand } from "./deployment-command.ts";
import { stackNames } from "./stacks.ts";

import type { DeploymentRequest } from "./config.ts";

const confirmation = "0".repeat(16);

const requestedBy = (args: readonly string[]) =>
  recordedRequests<DeploymentRequest>({
    args,
    program: (received) => deploymentCommand(received).pipe(runCommand({ version: "0.0.0" })),
  });

describe.for([
  { args: ["plan", "service-admin"], request: { operation: "plan", stacks: ["service-admin"] } },
  { args: ["plan", "all"], request: { operation: "plan", stacks: stackNames } },
  {
    args: ["deploy", "service-member", "--confirm-plan", confirmation],
    request: { confirmation, operation: "deploy", stack: "service-member" },
  },
  { args: ["deploy", "all"], request: { operation: "deploy-all", stacks: stackNames } },
])("the deployment command given $args", ({ args, request }) => {
  const it = test.extend("deployment", () => requestedBy(args));

  it("requests exactly that deployment", ({ deployment }) => {
    expect(deployment.requests).toStrictEqual([request]);
  });
});

describe.for([
  { args: ["deploy", "service-member"], accepted: ["--confirm-plan"] },
  { args: ["deploy", "all", "--confirm-plan", confirmation], accepted: [] },
  {
    args: ["deploy", "service-member", "--confirm-plan", confirmation, "--stage", "other"],
    accepted: ["--confirm-plan"],
  },
  { args: ["deploy", "service-member", "--confirm-plan", "not-a-confirmation"], accepted: [] },
  { args: ["deploy", "unknown"], accepted: ["all", ...stackNames] },
  { args: ["plan", "all", "--confirm-plan", confirmation], accepted: [] },
  { args: ["up", "all"], accepted: ["plan", "deploy"] },
  { args: ["deploy"], accepted: ["all", ...stackNames] },
])("the deployment command given $args", ({ accepted, args }) => {
  const it = test.extend("deployment", () => requestedBy(args));

  it("requests nothing", ({ deployment }) => {
    expect(deployment.run.rejection).toBeDefined();
    expect(deployment.requests).toStrictEqual([]);
  });

  it("prints the commands and arguments it accepts there", ({ deployment }) => {
    const usage = deployment.run.diagnostics.join("\n");
    expect(accepted.filter((value) => !usage.includes(value))).toStrictEqual([]);
  });
});

describe("the deploy subcommands", () => {
  it("cover every stack", () => {
    expect(
      subcommandNamesOf(
        deploymentCommand(() => Effect.void),
        "deploy",
      ),
    ).toStrictEqual(["all", ...stackNames]);
  });
});
