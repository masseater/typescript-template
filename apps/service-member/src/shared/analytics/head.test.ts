import { describe, expect, test } from "vite-plus/test";

import { googleAnalyticsBootstrap } from "./bootstrap.ts";
import { memberAppHead } from "./head.ts";

const measurementId = "G-TESTMEASUREMENT1";
const sampleMemberId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const sampleEmail = "member@example.test";

describe("memberAppHead", () => {
  describe("without a measurement id", () => {
    const it = test.extend("head", () => memberAppHead("Service", "/styles.css", undefined));

    it("does not add analytics scripts", ({ head }) => {
      expect(head.scripts).toBeUndefined();
    });
  });

  describe("with a measurement id", () => {
    const it = test.extend("head", () => memberAppHead("Service", "/styles.css", measurementId));

    it("loads gtag from Google Tag Manager", ({ head }) => {
      expect(head.scripts).toStrictEqual([
        {
          async: true,
          src: `https://www.googletagmanager.com/gtag/js?id=${measurementId}`,
        },
        { children: googleAnalyticsBootstrap(measurementId) },
      ]);
    });

    it("does not embed member identifiers in the injected snippet", ({ head }) => {
      const serialized = JSON.stringify(head);
      expect(serialized).not.toContain(sampleMemberId);
      expect(serialized).not.toContain(sampleEmail);
      expect(serialized).not.toContain("user_id");
      expect(head.scripts?.[1]?.children).not.toContain(sampleMemberId);
      expect(head.scripts?.[1]?.children).not.toContain(sampleEmail);
    });
  });
});
