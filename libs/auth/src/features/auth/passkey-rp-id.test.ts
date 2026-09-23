import { describe, expect, test } from "vite-plus/test";

import { passkeyRpId } from "./passkey-rp-id.ts";

describe("passkeyRpId", () => {
  describe("an origin that is not nested under a project domain", () => {
    const it = test
      .extend("appHost", () => passkeyRpId("https://app.example.com"))
      .extend("loopback", () => passkeyRpId("http://localhost:3001"))
      .extend("wikiHost", () => passkeyRpId("https://wiki.example.com"));

    it("keeps the host", ({ appHost }) => {
      expect(appHost).toStrictEqual("app.example.com");
    });

    it("keeps loopback", ({ loopback }) => {
      expect(loopback).toStrictEqual("localhost");
    });

    it("keeps a single-label wiki host", ({ wikiHost }) => {
      expect(wikiHost).toStrictEqual("wiki.example.com");
    });
  });

  describe("apps that sit under a project parent", () => {
    const it = test
      .extend("memberParent", () => passkeyRpId("https://service-member.publink.example.com"))
      .extend("adminParent", () => passkeyRpId("https://service-admin.publink.example.com"))
      .extend("dashboardParent", () =>
        passkeyRpId("https://internal-dashboard.publink.example.com"),
      );

    it("uses the project parent for the member app", ({ memberParent }) => {
      expect(memberParent).toStrictEqual("publink.example.com");
    });

    it("uses the project parent for the admin app", ({ adminParent }) => {
      expect(adminParent).toStrictEqual("publink.example.com");
    });

    it("uses the project parent for the dashboard", ({ dashboardParent }) => {
      expect(dashboardParent).toStrictEqual("publink.example.com");
    });
  });
});
