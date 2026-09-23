import { describe, expect, it } from "vite-plus/test";

import { reported } from "./lint-harness.ts";
import { isAppRouteModule } from "./thin-app-routes.ts";

const jsx = "export const Page = () => <div />;\n";
const plain = "export const Route = {};\n";

describe("thin app route coverage", () => {
  it.for([
    "apps/service-member/src/app/routes/_welcome.tsx",
    "apps/service-member/src/app/routes/_member/-board-route.tsx",
    "apps/service-admin/src/app/routes/-admin-layout.tsx",
    "apps/internal-dashboard/src/app/routes/wiki/-wiki-layout.tsx",
    "apps/internal-dashboard/src/app/routes/_dashboard/security.tsx",
  ])("rejects JSX in %s", (name) => {
    expect.hasAssertions();
    expect(reported("thin-app-routes", { code: jsx, filename: name })).toBe(true);
  });

  it.for([
    "apps/service-member/src/app/routes/__root.tsx",
    "apps/internal-dashboard/src/app/routes/-root-document.tsx",
    "apps/internal-dashboard/src/app/routes/-wiki-provider.tsx",
    "apps/service-member/src/pages/welcome/ui/choose-page.tsx",
  ])("allows %s", (name) => {
    expect.hasAssertions();
    expect(reported("thin-app-routes", { code: jsx, filename: name })).toBe(false);
  });

  it("allows a route file without JSX", () => {
    expect.hasAssertions();
    expect(
      reported("thin-app-routes", {
        code: plain,
        filename: "apps/service-member/src/app/routes/_member/home.tsx",
      }),
    ).toBe(false);
  });

  it.for([
    ["apps/service-member/src/app/routes/_welcome.tsx", true],
    ["apps/service-member/src/app/routes/__root.tsx", false],
    ["apps/internal-dashboard/src/app/routes/-wiki-provider.tsx", false],
    ["apps/service-member/src/pages/home/ui/home-page.tsx", false],
  ] as const)("classifies %s as app route subject %s", ([name, subject]) => {
    expect.hasAssertions();
    expect(isAppRouteModule(name)).toBe(subject);
  });
});
