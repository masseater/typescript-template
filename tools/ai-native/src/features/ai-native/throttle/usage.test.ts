import { describe, expect, test } from "vite-plus/test";

import { parseInvocation } from "./usage.ts";

const usageAnswer = parseInvocation([]);
const usage = typeof usageAnswer === "string" ? usageAnswer : "";

describe("parseInvocation", () => {
  describe("an option throttle does not know, written with a value", () => {
    const it = test.extend("theAnswerToAnUnknownOption", () =>
      parseInvocation(["--retries=3", "--", "true"]));

    it("names the option without its value and shows the usage", ({
      theAnswerToAnUnknownOption,
    }) => {
      expect(theAnswerToAnUnknownOption).toBe(`throttle: Unknown option '--retries'\n\n${usage}`);
    });
  });

  describe("a group of short flags throttle does not know", () => {
    const it = test.extend("theAnswerToAShortFlagGroup", () =>
      parseInvocation(["-vq", "--", "true"]));

    it("names the first flag of the group", ({ theAnswerToAShortFlagGroup }) => {
      expect(theAnswerToAShortFlagGroup).toBe(`throttle: Unknown option '-v'\n\n${usage}`);
    });
  });

  describe("a word before the separator that is not an option", () => {
    const it = test.extend("theAnswerToAStrayPositional", () =>
      parseInvocation(["--timeout", "5", "build", "--", "true"]));

    it("refuses the positional argument", ({ theAnswerToAStrayPositional }) => {
      expect(theAnswerToAStrayPositional).toBe(
        `throttle: Unexpected argument 'build'. This command does not take positional arguments\n\n${usage}`,
      );
    });
  });

  describe("a timeout flag with nothing after it before the separator", () => {
    const it = test.extend("theAnswerToAMissingTimeout", () =>
      parseInvocation(["--timeout", "--", "true"]));

    it("reports the missing value", ({ theAnswerToAMissingTimeout }) => {
      expect(theAnswerToAMissingTimeout).toBe(
        `throttle: Option '--timeout <value>' argument missing\n\n${usage}`,
      );
    });
  });

  describe("a timeout flag followed by something that looks like an option", () => {
    const it = test.extend("theAnswerToAnAmbiguousTimeout", () =>
      parseInvocation(["--timeout", "-5", "--", "true"]));

    it("reports the value as ambiguous and shows how to pass it", ({
      theAnswerToAnAmbiguousTimeout,
    }) => {
      expect(theAnswerToAnAmbiguousTimeout).toBe(
        `throttle: Option '--timeout' argument is ambiguous.\nDid you forget to specify the option argument for '--timeout'?\nTo specify an option argument starting with a dash use '--timeout=-XYZ'.\n\n${usage}`,
      );
    });
  });

  describe("a timeout flag followed by a lone dash", () => {
    const it = test.extend("theAnswerToALoneDashTimeout", () =>
      parseInvocation(["--timeout", "-", "--", "true"]));

    it("takes the dash as the value and rejects it as a number", ({
      theAnswerToALoneDashTimeout,
    }) => {
      expect(theAnswerToALoneDashTimeout).toBe(
        `throttle: --timeout expects a whole number of seconds, got "-"\n\n${usage}`,
      );
    });
  });

  describe("a timeout written inline with the flag", () => {
    const it = test.extend("theInvocationWithAnInlineTimeout", () =>
      parseInvocation(["--timeout=7", "--", "echo", "hi"]));

    it("runs the command with that timeout", ({ theInvocationWithAnInlineTimeout }) => {
      expect(theInvocationWithAnInlineTimeout).toStrictEqual({
        timeoutSec: 7,
        executable: "echo",
        args: ["hi"],
        commandLine: "echo hi",
      });
    });
  });
});
