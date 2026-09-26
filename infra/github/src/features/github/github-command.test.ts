import { runCommand } from "@repo/cli";
import { recordedRequests } from "@repo/cli/testing";
import { describe, expect, test } from "vite-plus/test";

import { githubCommand } from "./github-command.ts";

import type { GitHubRequest } from "./github-command.ts";

const confirmation = "0".repeat(16);

const requestedBy = (args: readonly string[]) =>
  recordedRequests<GitHubRequest>({
    args,
    program: (received) => githubCommand(received).pipe(runCommand({ version: "0.0.0" })),
  });

describe.for([
  { args: ["plan", "github"], request: { operation: "plan", unit: "github" } },
  {
    args: ["deploy", "wiki-publisher", "--confirm-plan", confirmation],
    request: { confirmation, operation: "deploy", unit: "wiki-publisher" },
  },
])("the github command given $args", ({ args, request }) => {
  const it = test.extend("deployment", () => requestedBy(args));

  it("requests exactly that operation", ({ deployment }) => {
    expect(deployment.requests).toStrictEqual([request]);
  });
});

describe.for([
  { args: ["deploy", "github"], accepted: ["--confirm-plan"] },
  { args: ["deploy", "github", "--confirm-plan", "not-a-confirmation"], accepted: [] },
  { args: ["plan", "cloudflare"], accepted: ["github", "wiki-publisher"] },
  { args: ["apply", "github"], accepted: ["plan", "deploy"] },
])("the github command given $args", ({ accepted, args }) => {
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
