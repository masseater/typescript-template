import { describe, expect, it } from "vite-plus/test";
import { validateOutputRead, validateStateCommand } from "./state.ts";

describe("pulumi state command guard", () => {
  it("reads only the public database target outputs", () => {
    expect.hasAssertions();
    expect(() => {
      validateOutputRead("databaseId");
    }).not.toThrow();
    expect(() => {
      validateOutputRead("applicationSettings");
    }).not.toThrow();
    expect(() => {
      validateOutputRead("authSecret");
    }).toThrow("state_output_not_allowed");
    expect(() => {
      validateOutputRead("otelHeaders");
    }).toThrow("state_output_not_allowed");
  });

  it("permits deployment commands without secret output", () => {
    expect.hasAssertions();
    expect(() => {
      validateStateCommand(["preview", "--cwd", "project"]);
    }).not.toThrow();
    expect(() => {
      validateStateCommand(["config", "set", "authSecret", "--secret"]);
    }).not.toThrow();
  });

  it.each([
    { args: ["stack", "output", "--show-secrets"], error: "plaintext_secret_output_forbidden" },
    { args: ["up", "--show-secrets=true"], error: "plaintext_secret_output_forbidden" },
    { args: ["config", "get", "authSecret"], error: "state_command_not_allowed" },
    { args: ["stack", "export"], error: "state_command_not_allowed" },
    { args: ["login"], error: "state_command_not_allowed" },
    { args: ["up", "--plaintext"], error: "plaintext_secret_output_forbidden" },
    { args: ["up", "-v=9"], error: "plaintext_secret_output_forbidden" },
    { args: ["up", "--logtostderr"], error: "plaintext_secret_output_forbidden" },
    { args: ["up", "--tracing", "file:trace"], error: "plaintext_secret_output_forbidden" },
  ] as const)("refuses secret output or backend switching: $args", ({ args, error }) => {
    expect.hasAssertions();
    expect(() => {
      validateStateCommand(args);
    }).toThrow(error);
  });
});
